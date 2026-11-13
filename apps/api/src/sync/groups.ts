// Backoffice (spec 032, D-214): the static registry of the sync groups backed by one table each (data-model.md "Nhóm,
// loại dòng, khóa so khớp"). The schema, settings and extensions groups have their own shape and are handled apart.
import type { Filter } from '@backoffice/types';
import type { GroupKey, Row } from './types.js';

export interface NestedKind {
	/** Property of the parent row that holds the nested rows. */
	name: 'operations' | 'panels';
	table: string;
	/** Column of the nested table pointing at the parent. */
	parent: string;
	ignore: string[];
}

export interface TableKind {
	group: GroupKey;
	kind: string;
	table: string;
	/** Matching key: `['id']`, or the natural key columns (clarify 4). */
	key: string[];
	/** Columns neither compared nor copied (FR-012, FR-024). */
	ignore: string[];
	/** Rows of the table that belong to the group. */
	filter?: Filter;
	nested?: NestedKind;
}

const CREATED = ['date_created', 'user_created'];

export const TABLE_KINDS: readonly TableKind[] = [
	{ group: 'folders', kind: 'folder', table: 'directus_folders', key: ['id'], ignore: [] },
	{ group: 'access', kind: 'role', table: 'directus_roles', key: ['id'], ignore: [] },
	{ group: 'access', kind: 'policy', table: 'directus_policies', key: ['id'], ignore: [] },
	// Only the role links: the user links are out of scope (FR-007 group 3).
	{
		group: 'access',
		kind: 'link',
		table: 'directus_access',
		key: ['id'],
		ignore: ['user'],
		filter: { user: { _null: true } },
	},
	{
		group: 'access',
		kind: 'permission',
		table: 'directus_permissions',
		key: ['policy', 'collection', 'action'],
		ignore: ['id'],
	},
	{
		group: 'access',
		kind: 'bo_permission',
		table: 'backoffice_permissions',
		key: ['policy', 'collection', 'action'],
		ignore: ['id'],
	},
	{
		group: 'translations',
		kind: 'translation',
		table: 'directus_translations',
		key: ['language', 'key'],
		ignore: ['id'],
	},
	// Global presets only (clarify: no user, no role).
	{
		group: 'presets',
		kind: 'preset',
		table: 'directus_presets',
		key: ['collection', 'bookmark'],
		ignore: ['id', 'user', 'role'],
		filter: { _and: [{ user: { _null: true } }, { role: { _null: true } }] },
	},
	{
		group: 'flows',
		kind: 'flow',
		table: 'directus_flows',
		key: ['id'],
		ignore: CREATED,
		nested: { name: 'operations', table: 'directus_operations', parent: 'flow', ignore: CREATED },
	},
	{
		group: 'dashboards',
		kind: 'dashboard',
		table: 'directus_dashboards',
		key: ['id'],
		ignore: CREATED,
		nested: { name: 'panels', table: 'directus_panels', parent: 'dashboard', ignore: CREATED },
	},
	// Definitions of spec 030 that are built: the name comes from the kind, collection and fields, so the same name is the
	// same index and an index is never "changed".
	{
		group: 'indexes',
		kind: 'index',
		table: 'backoffice_indexes',
		key: ['collection', 'name'],
		ignore: ['id', 'status', 'error', 'date_created'],
		filter: { status: { _eq: 'ready' } },
	},
];

/** Write order (data-model "Thứ tự áp dụng"); deletes run in the reverse order. */
export const WRITE_ORDER = [
	'folder',
	'role',
	'policy',
	'link',
	'permission',
	'bo_permission',
	'translation',
	'preset',
	'flow',
	'dashboard',
] as const;

export const tableKind = (kind: string): TableKind | undefined => TABLE_KINDS.find((k) => k.kind === kind);

export const rowId = (group: GroupKey, kind: string, key: string): string => `${group}/${kind}:${key}`;

/** The matching key of a row; a null column is an empty string (a preset without bookmark). */
export const keyOf = (kind: Pick<TableKind, 'key'>, row: Row): string =>
	kind.key.map((column) => (row[column] === null || row[column] === undefined ? '' : String(row[column]))).join(':');

/** The row without the columns that are neither compared nor copied, nested rows included. */
export function strip(kind: TableKind, row: Row): Row {
	const out: Row = {};

	for (const [column, value] of Object.entries(row)) {
		if (kind.ignore.includes(column)) continue;

		if (kind.nested && column === kind.nested.name && Array.isArray(value)) {
			const ignore = kind.nested.ignore;
			out[column] = (value as Row[]).map((nested) =>
				Object.fromEntries(Object.entries(nested).filter(([c]) => !ignore.includes(c))),
			);

			continue;
		}

		out[column] = value;
	}

	return out;
}
