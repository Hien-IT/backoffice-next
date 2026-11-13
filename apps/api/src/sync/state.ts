// Backoffice (spec 032, D-214, research R1/R9/R10): the config of the sync groups of one instance. The source serves it
// at GET /backoffice/sync/state and the target reads its own with the same function, so both sides serialize alike.
import type { Accountability, Filter, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import { ExtensionsService } from '../services/extensions.service.js';
import { ItemsService } from '../services/items.service.js';
import { getSnapshot } from '../utils/get-snapshot.js';
import { TABLE_KINDS, type TableKind } from './groups.js';
import type { GroupKey, Row, SyncExtension, SyncState } from './types.js';

export interface StateContext {
	knex: Knex;
	schema: SchemaOverview;
	accountability: Accountability | null;
}

/** Specials whose value is encrypted or masked on read: never compared, never copied (FR-013, clarify 3). */
export const HIDDEN_SPECIALS = ['encrypt', 'conceal', 'hash'];

/** Real (non-alias) columns of a collection, without the hidden ones. */
export function columnsOf(schema: SchemaOverview, table: string): string[] {
	const fields = schema.collections[table]?.fields ?? {};

	return Object.values(fields)
		.filter((field) => field.type !== 'alias' && !field.special?.some((s) => HIDDEN_SPECIALS.includes(s)))
		.map((field) => field.field);
}

/** Settings fields that are encrypted or masked on read; the diff shows them as rows that cannot be ticked. */
export function hiddenSettingsFields(schema: SchemaOverview): string[] {
	const fields = schema.collections['directus_settings']?.fields ?? {};

	return Object.values(fields)
		.filter((field) => field.special?.some((s) => HIDDEN_SPECIALS.includes(s)))
		.map((field) => field.field);
}

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

async function readTable(table: string, filter: Filter | undefined, ctx: StateContext): Promise<Row[]> {
	const fields = columnsOf(ctx.schema, table);
	if (fields.length === 0) return [];

	const primary = ctx.schema.collections[table]!.primary;
	const service = new ItemsService(table, { knex: ctx.knex, schema: ctx.schema, accountability: ctx.accountability });

	const rows = await service.readByQuery({ fields, limit: -1, sort: [primary], ...(filter ? { filter } : {}) });
	return plain(rows) as Row[];
}

async function readKind(kind: TableKind, ctx: StateContext): Promise<Row[]> {
	const rows = await readTable(kind.table, kind.filter, ctx);
	if (!kind.nested) return rows;

	const { name, table, parent } = kind.nested;
	const nested = await readTable(table, undefined, ctx);

	return rows.map((row) => ({ ...row, [name]: nested.filter((child) => child[parent] === row['id']) }));
}

async function readExtensions(ctx: StateContext): Promise<SyncExtension[]> {
	const service = new ExtensionsService({ knex: ctx.knex, schema: ctx.schema, accountability: ctx.accountability });
	const all = await service.readAll();
	const names = new Map(all.map((ext) => [ext.id, (ext.schema as { name?: string } | null)?.name ?? ext.meta.folder]));

	return all
		.map((ext) => {
			const own = (ext.schema as { name?: string } | null)?.name ?? ext.meta.folder;
			const parent = ext.bundle ? (names.get(ext.bundle) ?? null) : null;

			return { id: ext.id, name: parent ? `${parent}/${own}` : own, bundle: parent, enabled: ext.meta.enabled };
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readState(groups: readonly GroupKey[], ctx: StateContext): Promise<SyncState> {
	const state: SyncState = {};

	if (groups.includes('schema')) {
		const { systemFields: _systemFields, ...snapshot } = await getSnapshot({ database: ctx.knex, schema: ctx.schema });
		state.schema = plain(snapshot);
	}

	const kinds = (group: GroupKey) => TABLE_KINDS.filter((kind) => kind.group === group);
	const byKind = async (kind: string) => readKind(TABLE_KINDS.find((k) => k.kind === kind)!, ctx);

	for (const group of ['flows', 'translations', 'presets', 'dashboards', 'indexes', 'folders'] as const) {
		if (groups.includes(group)) state[group] = await readKind(kinds(group)[0]!, ctx);
	}

	if (groups.includes('access')) {
		state.access = {
			roles: await byKind('role'),
			policies: await byKind('policy'),
			links: await byKind('link'),
			permissions: await byKind('permission'),
			bo_permissions: await byKind('bo_permission'),
		};
	}

	if (groups.includes('settings')) {
		const [settings] = await readTable('directus_settings', undefined, ctx);
		state.settings = settings ?? null;
	}

	if (groups.includes('extensions')) state.extensions = await readExtensions(ctx);

	return state;
}
