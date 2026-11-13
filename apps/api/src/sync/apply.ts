// Backoffice (spec 032, D-214, research R4/R5/R7/R10, data-model.md "Thứ tự áp dụng"): writes the ticked rows into the
// target inside one transaction through the existing services (activity and revisions as for a manual edit), then runs
// once after the commit what those services did before it (cache clear, flow and extension reload) and the index jobs.
import { InvalidPayloadError, isBackofficeError } from '@backoffice/errors';
import type { Accountability, PrimaryKey, SchemaOverview, Snapshot, SnapshotDiff } from '@backoffice/types';
import { fetchGlobalAccessForRoles, fetchGlobalAccessForUser } from '@backoffice/utils/node';
import type { Knex } from 'knex';
import { flushCaches } from '../cache.js';
import { getExtensionManager } from '../extensions/index.js';
import { getFlowManager } from '../flows.js';
import { clearCache as clearPermissionsCache } from '../permissions/cache.js';
import { fetchRolesTree } from '../permissions/lib/fetch-roles-tree.js';
import { AccessService } from '../services/access.service.js';
import { BackofficeIndexesService } from '../services/backoffice-indexes.service.js';
import { BackofficePermissionsService } from '../services/backoffice-permissions.service.js';
import { DashboardsService } from '../services/dashboards.service.js';
import { ExtensionsService } from '../services/extensions.service.js';
import { FoldersService } from '../services/folders.service.js';
import { ItemsService } from '../services/items.service.js';
import { PanelsService } from '../services/panels.service.js';
import { PermissionsService } from '../services/permissions.service.js';
import { PoliciesService } from '../services/policies.service.js';
import { PresetsService } from '../services/presets.service.js';
import { RolesService } from '../services/roles.service.js';
import { TranslationsService } from '../services/translations.service.js';
import { applyDiff } from '../utils/apply-diff.js';
import { getSnapshotDiff } from '../utils/get-snapshot-diff.js';
import { tableKind, WRITE_ORDER } from './groups.js';
import type { GroupKey, Row, SyncIndexResult, SyncResult, SyncRow } from './types.js';

export interface ApplyContext {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability;
}

type Counts = Pick<SyncResult, 'created' | 'updated' | 'deleted' | 'deletedLabels'>;

const bump = (map: Partial<Record<GroupKey, number>>, group: GroupKey) => (map[group] = (map[group] ?? 0) + 1);

/** Names the row of a failed write in the error (contracts/api.md), then rethrows it. */
async function attempt<T>(row: SyncRow, write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		if (isBackofficeError(error))
			(error as { extensions: Record<string, unknown> }).extensions = { ...(error.extensions ?? {}), row: row.id };
		throw error;
	}
}

/** The part of the snapshot diff the ticked data model rows stand for; a new collection brings its new fields. */
export function selectSchemaDiff(rows: SyncRow[], source: Snapshot, target: Snapshot): SnapshotDiff | null {
	const pick = (kind: string) => new Set(rows.filter((r) => r.group === 'schema' && r.kind === kind).map((r) => r.key));
	const collections = pick('collection');
	const fields = pick('field');
	const relations = pick('relation');
	if (collections.size + fields.size + relations.size === 0) return null;

	const delta = getSnapshotDiff(target, source);
	const created = new Set(
		delta.collections.filter((c) => collections.has(c.collection) && c.diff[0]?.kind === 'N').map((c) => c.collection),
	);

	return {
		collections: delta.collections.filter((c) => collections.has(c.collection)),
		fields: delta.fields.filter((f) => fields.has(`${f.collection}.${f.field}`) || created.has(f.collection)),
		systemFields: [],
		relations: delta.relations.filter((r) => relations.has(`${r.collection}.${r.field}`)),
	};
}

export async function applySchema(
	trx: Knex,
	rows: SyncRow[],
	source: Snapshot,
	target: Snapshot,
	schema: SchemaOverview,
): Promise<boolean> {
	const diff = selectSchemaDiff(rows, source, target);
	if (!diff) return false;
	await applyDiff({ ...target, systemFields: [] }, diff, { database: trx, schema });
	return true;
}

function services(ctx: ApplyContext) {
	const o = { knex: ctx.knex, schema: ctx.schema, accountability: ctx.accountability };

	return {
		folder: new FoldersService(o),
		role: new RolesService(o),
		policy: new PoliciesService(o),
		link: new AccessService(o),
		permission: new PermissionsService(o),
		bo_permission: new BackofficePermissionsService(o),
		translation: new TranslationsService(o),
		preset: new PresetsService(o),
		// Not FlowsService/OperationsService: they reload the flows after every write, before the commit (research R5).
		flow: new ItemsService('directus_flows', o),
		operation: new ItemsService('directus_operations', o),
		dashboard: new DashboardsService(o),
		panel: new PanelsService(o),
	};
}

type Services = ReturnType<typeof services>;

/** Depth of a row in its parent chain (folders, roles): parents are written first, children deleted first. */
function depth(row: Row, all: Row[], parent: string): number {
	let level = 0;
	let current: Row | undefined = row;
	const seen = new Set<unknown>();

	while (current?.[parent] && !seen.has(current[parent])) {
		seen.add(current[parent]);
		current = all.find((r) => r['id'] === current![parent]);
		level++;
	}

	return level;
}

const without = (row: Row, ...columns: string[]) =>
	Object.fromEntries(Object.entries(row).filter(([column]) => !columns.includes(column)));

async function exists(knex: Knex, table: string, id: unknown): Promise<boolean> {
	return Boolean(
		await knex
			.select('id')
			.from(table)
			.where('id', id as string)
			.first(),
	);
}

async function deleteRow(row: SyncRow, s: Services, ctx: ApplyContext): Promise<boolean> {
	const target = row.target!;
	const id = target['id'] as PrimaryKey;
	const kind = tableKind(row.kind)!;

	// A row already removed by a cascade (collection, policy, role) is skipped.
	if (!(await exists(ctx.knex, kind.table, id))) return false;

	if (row.kind === 'flow') {
		const operations = ((target['operations'] as Row[]) ?? []).map((o) => o['id'] as PrimaryKey);
		// The resolve/reject FKs have no ON DELETE: free them first, as FlowsService.deleteMany does.
		if (operations.length > 0) await s.operation.updateMany(operations, { resolve: null, reject: null });
	}

	await s[row.kind as keyof Services].deleteOne(id);
	return true;
}

/** Operations of a flow, or panels of a dashboard, made equal to the source (FR-017). */
async function syncChildren(
	service: ItemsService,
	parentColumn: string,
	parentId: unknown,
	sourceChildren: Row[],
	targetChildren: Row[],
	links: string[] = [],
): Promise<void> {
	const sourceIds = new Set(sourceChildren.map((c) => c['id']));
	const targetIds = new Set(targetChildren.map((c) => c['id']));

	if (links.length > 0 && targetChildren.length > 0) {
		await service.updateMany(
			targetChildren.map((c) => c['id'] as PrimaryKey),
			Object.fromEntries(links.map((l) => [l, null])),
		);
	}

	const gone = targetChildren.filter((c) => !sourceIds.has(c['id'])).map((c) => c['id'] as PrimaryKey);
	if (gone.length > 0) await service.deleteMany(gone);

	for (const child of sourceChildren) {
		const data = { ...without(child, ...links), [parentColumn]: parentId };
		if (targetIds.has(child['id'])) await service.updateOne(child['id'] as PrimaryKey, without(data, 'id'));
		else await service.createOne({ ...data, ...Object.fromEntries(links.map((l) => [l, null])) });
	}

	for (const child of sourceChildren) {
		const set = Object.fromEntries(
			links.filter((l) => child[l] !== null && child[l] !== undefined).map((l) => [l, child[l]]),
		);
		if (Object.keys(set).length > 0) await service.updateOne(child['id'] as PrimaryKey, set);
	}
}

async function writeFlow(row: SyncRow, s: Services): Promise<void> {
	const source = row.source!;
	const id = source['id'] as PrimaryKey;
	const fields = without(source, 'operations', 'operation');

	if (row.state === 'source_only') await s.flow.createOne({ ...fields, operation: null });
	else await s.flow.updateOne(id, { ...without(fields, 'id'), operation: null });

	await syncChildren(
		s.operation,
		'flow',
		id,
		(source['operations'] as Row[]) ?? [],
		row.state === 'changed' ? ((row.target!['operations'] as Row[]) ?? []) : [],
		['resolve', 'reject'],
	);

	if (source['operation']) await s.flow.updateOne(id, { operation: source['operation'] });
}

async function writeDashboard(row: SyncRow, s: Services): Promise<void> {
	const source = row.source!;
	const id = source['id'] as PrimaryKey;
	const fields = without(source, 'panels');

	if (row.state === 'source_only') await s.dashboard.createOne(fields);
	else await s.dashboard.updateOne(id, without(fields, 'id'));

	await syncChildren(
		s.panel,
		'dashboard',
		id,
		(source['panels'] as Row[]) ?? [],
		row.state === 'changed' ? ((row.target!['panels'] as Row[]) ?? []) : [],
	);
}

async function writeRow(row: SyncRow, s: Services): Promise<void> {
	if (row.kind === 'flow') return writeFlow(row, s);
	if (row.kind === 'dashboard') return writeDashboard(row, s);

	const service = s[row.kind as keyof Services];
	const kind = tableKind(row.kind)!;
	const source = row.source!;

	if (row.state === 'source_only') {
		await service.createOne(source);
		return;
	}

	// Matched by id: the key is the id; matched by a natural key: the target row keeps its own id.
	const id = (kind.key[0] === 'id' ? source['id'] : row.target!['id']) as PrimaryKey;
	await service.updateOne(id, without(source, 'id'));
}

/** Writes the ticked non-schema rows: deletes in the reverse order, then creates and updates, settings, extensions. */
export async function writeRows(rows: SyncRow[], ctx: ApplyContext): Promise<Counts> {
	const counts: Counts = { created: {}, updated: {}, deleted: {}, deletedLabels: [] };
	const s = services(ctx);
	const ordered = (kind: string, state: SyncRow['state']) => rows.filter((r) => r.kind === kind && r.state === state);

	for (const kind of [...WRITE_ORDER].reverse()) {
		let list = ordered(kind, 'target_only');
		if (kind === 'folder' || kind === 'role') {
			const all = list.map((r) => r.target!);
			list = [...list].sort((a, b) => depth(b.target!, all, 'parent') - depth(a.target!, all, 'parent'));
		}

		for (const row of list) {
			if (await attempt(row, () => deleteRow(row, s, ctx))) {
				bump(counts.deleted, row.group);
				counts.deletedLabels.push(row.label);
			}
		}
	}

	for (const kind of WRITE_ORDER) {
		let list = rows.filter((r) => r.kind === kind && (r.state === 'source_only' || r.state === 'changed'));
		if (kind === 'folder' || kind === 'role') {
			const all = list.map((r) => r.source!);
			list = [...list].sort((a, b) => depth(a.source!, all, 'parent') - depth(b.source!, all, 'parent'));
		}

		for (const row of list) {
			await attempt(row, () => writeRow(row, s));
			bump(row.state === 'source_only' ? counts.created : counts.updated, row.group);
		}
	}

	const settings = rows.filter((r) => r.group === 'settings' && r.state === 'changed');
	if (settings.length > 0) {
		const payload = Object.assign({}, ...settings.map((r) => r.source));
		await attempt(settings[0]!, () => new ItemsService('directus_settings', { ...ctx }).upsertSingleton(payload));
		for (const _ of settings) bump(counts.updated, 'settings');
	}

	const extensions = rows.filter((r) => r.group === 'extensions' && r.state === 'changed');
	if (extensions.length > 0) {
		const service = new ExtensionsService({ ...ctx });
		for (const row of extensions) {
			await attempt(row, () =>
				service.updateOne(String(row.target!['id']), { meta: { enabled: row.source!['enabled'] as boolean } }),
			);
			bump(counts.updated, 'extensions');
		}
	}

	return counts;
}

/** FR-027: the caller must still be admin after the writes, read through the transaction (no cache). */
export async function assertCallerAdmin(ctx: ApplyContext): Promise<void> {
	const user = ctx.accountability.user;
	if (!user) return;

	const record = await ctx.knex.select('role').from('directus_users').where('id', user).first();
	const roles = await fetchRolesTree(record?.role ?? null, { knex: ctx.knex });
	const ip = ctx.accountability.ip ?? null;

	const viaRoles = await fetchGlobalAccessForRoles(roles, { knex: ctx.knex, ip });
	const viaUser = await fetchGlobalAccessForUser(user, { knex: ctx.knex, ip });

	if (!viaRoles.admin && !viaUser.admin) {
		throw new InvalidPayloadError({ reason: 'This change would remove your own admin access' });
	}
}

/** After the commit: what the services did before it, once, and the index jobs; failures become warnings (FR-025). */
export async function afterCommit(
	written: Set<GroupKey>,
	indexRows: SyncRow[],
	ctx: Omit<ApplyContext, 'knex'> & { knex: Knex },
): Promise<Pick<SyncResult, 'indexes' | 'warnings'>> {
	const warnings: string[] = [];
	const step = async (name: string, run: () => Promise<unknown>) => {
		try {
			await run();
		} catch {
			warnings.push(name);
		}
	};

	if (written.size > 0) {
		// System, schema and response caches (shared with DR by key), then the permissions cache; publishes schemaChanged.
		await step('cache', async () => {
			await flushCaches();
			await clearPermissionsCache();
		});
	}

	if (written.has('flows')) await step('flows', () => getFlowManager().reload());

	if (written.has('extensions')) {
		await step('extensions', async () => {
			const manager = getExtensionManager();
			await manager.reload();
			await manager.broadcastReloadNotification();
		});
	}

	const indexes: SyncIndexResult[] = [];
	const service = new BackofficeIndexesService({
		knex: ctx.knex,
		schema: ctx.schema,
		accountability: ctx.accountability,
	});

	for (const row of indexRows) {
		const data = (row.source ?? row.target)!;
		const collection = String(data['collection']);
		const name = String(data['name']);

		try {
			if (row.state === 'source_only') {
				await service.create(collection, {
					fields: data['fields'] as string[],
					type: data['type'] as never,
					unique: data['unique'] === true,
				});
				indexes.push({ collection, name, action: 'create', status: 'creating' });
			} else if (row.state === 'target_only') {
				await service.remove(collection, name);
				indexes.push({ collection, name, action: 'delete', status: 'done' });
			}
		} catch (error) {
			indexes.push({
				collection,
				name,
				action: row.state === 'source_only' ? 'create' : 'delete',
				status: 'failed',
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { indexes, warnings };
}
