// Backoffice (spec 032, D-214, contracts/api.md): environment sync. The target reads the config of a source Backoffice
// (URL + static admin token, nothing stored), compares it with its own and applies the rows the admin ticked.
import { ForbiddenError, InvalidPayloadError, InvalidQueryError, ServiceUnavailableError } from '@backoffice/errors';
import type { AbstractServiceOptions, Accountability, SchemaOverview, Snapshot } from '@backoffice/types';
import type { Knex } from 'knex';
import { DIRECTUS_COMPAT_VERSION } from '../constants.js';
import getDatabase, { getDatabaseClient } from '../database/index.js';
import { checkMigrations } from '../database/validate-migrations.js';
import { useLock } from '../lock/index.js';
import { useLogger } from '../logger/index.js';
import { getSchema } from '../schema/get-database-schema.js';
import { afterCommit, applySchema, assertCallerAdmin, writeRows } from '../sync/apply.js';
import { diffStates, hashStates } from '../sync/diff.js';
import { fetchInfo, fetchState, normalizeUrl } from '../sync/source.js';
import { readState } from '../sync/state.js';
import {
	GROUP_KEYS,
	type GroupKey,
	type Row,
	type SyncInfo,
	type SyncResult,
	type SyncRow,
	type SyncState,
} from '../sync/types.js';
import { transaction } from '../utils/transaction.js';
import { validateSnapshot } from '../utils/validate-snapshot.js';
import { BACKOFFICE_VERSION } from '../version.js';

export interface SyncRequest {
	url: string;
	token: string;
	groups?: GroupKey[];
}

export interface SyncApplyRequest extends SyncRequest {
	hash: string;
	selected: string[];
}

export interface SyncDiff {
	hash: string;
	source: SyncInfo;
	groups: GroupKey[];
	rows: SyncRow[];
}

/** `?groups=a,b` or a body list; empty means every group, an unknown name is a 400. */
export function parseGroups(raw: unknown): GroupKey[] {
	if (raw === undefined || raw === null || raw === '') return [...GROUP_KEYS];
	const list = Array.isArray(raw)
		? raw.map(String)
		: String(raw)
				.split(',')
				.map((g) => g.trim())
				.filter(Boolean);
	const unknown = list.filter((g) => !(GROUP_KEYS as readonly string[]).includes(g));
	if (unknown.length > 0) throw new InvalidQueryError({ reason: `Unknown sync group "${unknown[0]}"` });
	return GROUP_KEYS.filter((g) => list.includes(g));
}

/** Refuses before any config is read when the two instances do not run the same version and migrations (FR-005). */
export function compareInfo(source: SyncInfo, target: SyncInfo, groups: readonly GroupKey[]): void {
	if (source.backoffice !== target.backoffice) {
		throw new InvalidPayloadError({
			reason: `Version mismatch: source Backoffice ${source.backoffice}, target ${target.backoffice}`,
		});
	}

	if (source.directus !== target.directus) {
		throw new InvalidPayloadError({
			reason: `Version mismatch: source Directus ${source.directus}, target ${target.directus}`,
		});
	}

	const differ = (a: string[], b: string[]) =>
		a.filter((v) => !b.includes(v)).length + b.filter((v) => !a.includes(v)).length;
	const count =
		differ(source.migrations.directus, target.migrations.directus) +
		differ(source.migrations.backoffice, target.migrations.backoffice);

	if (count > 0) throw new InvalidPayloadError({ reason: `Migration mismatch: ${count} differ` });

	// Clarify 5: only the data model needs the same vendor (the snapshot check); the other groups run.
	if (groups.includes('schema') && source.vendor !== target.vendor) {
		throw new InvalidPayloadError({
			reason: `Data model cannot be compared between ${source.vendor} and ${target.vendor}`,
		});
	}
}

/**
 * The ticked rows, checked on the server whatever the page did (FR-020): known, tickable, with every dependency that
 * still needs applying, and a delete with every row deleted along. Returns them in comparison order.
 */
export function validateSelection(rows: SyncRow[], selected: string[]): SyncRow[] {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const ticked = new Set(selected);

	for (const id of ticked) {
		const row = byId.get(id);
		if (!row) throw new InvalidPayloadError({ reason: `Unknown row "${id}"` });

		if (!row.selectable || row.state === 'same') {
			throw new InvalidPayloadError({ reason: `Row "${id}" cannot be applied: ${row.reason ?? 'same'}` });
		}

		const missing = row.depends.find((dep) => !ticked.has(dep));
		if (missing) throw new InvalidPayloadError({ reason: `Row "${id}" needs "${missing}"` });

		if (row.state === 'target_only') {
			const along = row.cascade.find((child) => !ticked.has(child));
			if (along) throw new InvalidPayloadError({ reason: `Deleting "${id}" also deletes "${along}"` });
		}
	}

	return rows.filter((row) => ticked.has(row.id));
}

const busy = () => new ServiceUnavailableError({ service: 'sync', reason: 'Another sync is being applied' });

/** Set while this process applies; with Redis the lock is the exclusion between instances (FR-026, research R6). */
let applying = false;

/** The answer of POST /backoffice/sync/diff: a `same` row carries no values. */
const slim = (row: SyncRow): SyncRow => {
	if (row.state !== 'same') return row;
	const { source: _s, target: _t, changes: _c, ...rest } = row;
	return rest;
};

export class BackofficeSyncService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex ?? getDatabase();
		this.accountability = options.accountability ?? null;
		this.schema = options.schema;
	}

	private assertAdmin(): void {
		if (this.accountability?.admin !== true) throw new ForbiddenError();
	}

	private context() {
		return { knex: this.knex, schema: this.schema, accountability: this.accountability };
	}

	async info(): Promise<SyncInfo> {
		this.assertAdmin();
		const { completed, boCompleted } = await checkMigrations(this.knex);

		return {
			backoffice: BACKOFFICE_VERSION,
			directus: DIRECTUS_COMPAT_VERSION,
			vendor: getDatabaseClient(this.knex),
			migrations: { directus: completed, backoffice: boCompleted },
		};
	}

	async state(groups: GroupKey[]): Promise<{ info: SyncInfo; state: SyncState }> {
		this.assertAdmin();
		return { info: await this.info(), state: await readState(groups, this.context()) };
	}

	/** Reads both sides and compares them; shared by diff and apply (apply calls it again under the lock, FR-022). */
	async compare(request: SyncRequest): Promise<SyncDiff & { sourceState: SyncState; targetState: SyncState }> {
		this.assertAdmin();
		const groups = parseGroups(request.groups);
		const base = normalizeUrl(request.url);

		const source = await fetchInfo(base, request.token);
		compareInfo(source, await this.info(), groups);

		const sourceState = await fetchState(base, request.token, groups, this.schema);

		if (sourceState.schema) {
			try {
				validateSnapshot({ ...sourceState.schema, systemFields: [] } as Snapshot);
			} catch {
				throw new ServiceUnavailableError({ service: 'sync', reason: 'The source returned an unexpected response' });
			}
		}

		const targetState = await readState(groups, this.context());
		const targetRefs = await this.targetRefs(sourceState.settings);
		const rows = diffStates(sourceState, targetState, groups, { schema: this.schema, targetRefs });
		await this.addImpact(rows);

		return { hash: hashStates(sourceState, targetState, groups), source, groups, rows, sourceState, targetState };
	}

	async diff(request: SyncRequest): Promise<SyncDiff> {
		const { hash, source, groups, rows } = await this.compare(request);
		return { hash, source, groups, rows: rows.map(slim) };
	}

	/**
	 * Applies the ticked rows: under the lock, both sides are read again and the hash checked (FR-022), then one
	 * transaction writes the data model and the rows and checks the caller is still admin; after the commit the caches,
	 * reloads and index jobs run once (research R4, R5, R6, R10).
	 */
	async apply(request: SyncApplyRequest): Promise<SyncResult> {
		this.assertAdmin();
		if (applying) throw busy();
		applying = true;

		try {
			return await useLock().usingLock('backoffice-sync-apply', () => this.applyLocked(request));
		} catch (error) {
			// Redlock gives up after its retries (about 5 s) while another instance holds the lock.
			if ((error as { name?: string } | null)?.name === 'ExecutionError') throw busy();
			throw error;
		} finally {
			applying = false;
		}
	}

	private async applyLocked(request: SyncApplyRequest): Promise<SyncResult> {
		const compared = await this.compare(request);

		if (compared.hash !== request.hash) {
			throw new InvalidPayloadError({ reason: 'The comparison is out of date, compare again' });
		}

		const rows = validateSelection(compared.rows, request.selected);
		const accountability = this.accountability!;
		const written = new Set<GroupKey>();
		const counts: Pick<SyncResult, 'created' | 'updated' | 'deleted' | 'deletedLabels'> = {
			created: {},
			updated: {},
			deleted: {},
			deletedLabels: [],
		};

		await transaction(this.knex, async (trx) => {
			let schema = this.schema;
			const schemaRows = rows.filter((r) => r.group === 'schema');

			if (compared.sourceState.schema && compared.targetState.schema) {
				const wrote = await applySchema(
					trx,
					schemaRows,
					{ ...compared.sourceState.schema, systemFields: [] } as Snapshot,
					{ ...compared.targetState.schema, systemFields: [] } as Snapshot,
					schema,
				);

				if (wrote) {
					written.add('schema');
					schema = await getSchema({ database: trx, bypassCache: true });

					for (const row of schemaRows) {
						const map =
							row.state === 'source_only' ? counts.created : row.state === 'changed' ? counts.updated : counts.deleted;
						map.schema = (map.schema ?? 0) + 1;
						if (row.state === 'target_only') counts.deletedLabels.push(row.label);
					}
				}
			}

			const ctx = { knex: trx, schema, accountability };
			const rest = await writeRows(
				rows.filter((r) => r.group !== 'schema' && r.group !== 'indexes'),
				ctx,
			);

			for (const key of ['created', 'updated', 'deleted'] as const) {
				for (const [group, n] of Object.entries(rest[key]) as [GroupKey, number][]) {
					counts[key][group] = (counts[key][group] ?? 0) + n;
					written.add(group);
				}
			}

			counts.deletedLabels.push(...rest.deletedLabels);
			await assertCallerAdmin(ctx);
		});

		const indexRows = rows.filter((r) => r.group === 'indexes');
		if (indexRows.length > 0) written.add('indexes');

		const schema = written.has('schema') ? await getSchema({ database: this.knex, bypassCache: true }) : this.schema;
		const after = await afterCommit(written, indexRows, { knex: this.knex, schema, accountability });

		for (const row of indexRows) {
			const map = row.state === 'source_only' ? counts.created : counts.deleted;
			map.indexes = (map.indexes ?? 0) + 1;
		}

		const total = (map: Partial<Record<GroupKey, number>>) => Object.values(map).reduce((a, b) => a + (b ?? 0), 0);
		useLogger().info(
			`Environment sync applied: ${total(counts.created)} created, ${total(counts.updated)} updated, ${total(counts.deleted)} deleted`,
		);

		return { ...counts, ...after };
	}

	/** Files, folders and roles at the target that settings fields of the source point at (clarify 2). */
	private async targetRefs(settings: Row | null | undefined) {
		const refs = { files: new Set<string>(), folders: new Set<string>(), roles: new Set<string>() };
		if (!settings) return refs;

		const tables = { directus_files: refs.files, directus_folders: refs.folders, directus_roles: refs.roles } as const;

		for (const relation of this.schema.relations.filter((r) => r.collection === 'directus_settings')) {
			const value = settings[relation.field];
			const set = tables[relation.related_collection as keyof typeof tables];
			if (typeof value !== 'string' || !set) continue;

			const found = await this.knex.select('id').from(relation.related_collection!).where('id', value).first();
			if (found) set.add(value);
		}

		return refs;
	}

	/** What a delete takes with it, for the confirm dialog (FR-021). */
	private async addImpact(rows: SyncRow[]): Promise<void> {
		const count = async (table: string, where?: Record<string, unknown>) => {
			const query = this.knex(table).count({ count: '*' });
			const result = await (where ? query.where(where) : query).first();
			return Number(result?.['count'] ?? 0);
		};

		for (const row of rows) {
			if (row.state !== 'target_only') continue;
			const id = row.target?.['id'];

			if (row.kind === 'collection' && this.schema.collections[row.key]) row.impact = { items: await count(row.key) };
			if (row.kind === 'role') row.impact = { users: await count('directus_users', { role: id }) };
			if (row.kind === 'policy') row.impact = { permissions: await count('directus_permissions', { policy: id }) };
			if (row.kind === 'folder') row.impact = { files: await count('directus_files', { folder: id }) };
		}
	}
}
