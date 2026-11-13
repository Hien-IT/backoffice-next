// Backoffice (spec 032, D-214, research R3/R7/R10/R14, data-model.md): compares the source and target states into rows
// with one of four states, their dependencies, the rows deleted with them, and whether they can be ticked.
import type { Relation, SchemaOverview, Snapshot } from '@backoffice/types';
import deepDiff from 'deep-diff';
import { getSnapshotDiff } from '../utils/get-snapshot-diff.js';
import { getVersionedHash } from '../utils/get-versioned-hash.js';
import { keyOf, rowId, strip, TABLE_KINDS, type TableKind } from './groups.js';
import { hiddenSettingsFields } from './state.js';
import type { GroupKey, Row, RowState, SyncChange, SyncRow, SyncState } from './types.js';

export interface DiffContext {
	/** Target schema (both sides run the same version, so the field lists are the same). */
	schema: SchemaOverview;
	/** Ids that exist at the target, for settings fields pointing at a file, folder or role (clarify 2). */
	targetRefs?: { files: Set<string>; folders: Set<string>; roles: Set<string> };
}

/** Deterministic JSON for deep comparisons (object keys sorted). */
export function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;

	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
	}

	return JSON.stringify(value ?? null);
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

function changesOf(source: Row, target: Row, kind?: TableKind): SyncChange[] {
	const changes: SyncChange[] = [];
	const nested = kind?.nested?.name;

	for (const column of new Set([...Object.keys(source), ...Object.keys(target)])) {
		if (column === nested) {
			const byId = (rows: unknown) => new Map(((rows as Row[]) ?? []).map((r) => [String(r['id']), r]));
			const s = byId(source[column]);
			const t = byId(target[column]);

			for (const id of new Set([...s.keys(), ...t.keys()])) {
				const sr = s.get(id);
				const tr = t.get(id);
				if (!sr || !tr) changes.push({ path: `${column}.${id}`, source: sr ?? null, target: tr ?? null });
				else changes.push(...changesOf(sr, tr).map((c) => ({ ...c, path: `${column}.${id}.${c.path}` })));
			}

			continue;
		}

		if (!same(source[column], target[column])) {
			changes.push({ path: column, source: source[column] ?? null, target: target[column] ?? null });
		}
	}

	return changes;
}

const base = (
	group: GroupKey,
	kind: string,
	key: string,
	label: string,
	state: RowState,
): Omit<SyncRow, 'depends' | 'cascade' | 'selectable'> & {
	depends: string[];
	cascade: string[];
	selectable: boolean;
} => ({
	id: rowId(group, kind, key),
	group,
	kind,
	key,
	label,
	state,
	depends: [],
	cascade: [],
	selectable: state !== 'same',
});

/** Rows of a table kind, matched by key; the 2nd+ row of a duplicated key cannot be ticked. */
function diffTable(kind: TableKind, source: Row[], target: Row[], label: (row: Row) => string): SyncRow[] {
	const rows: SyncRow[] = [];
	const index = (list: Row[]) => {
		const map = new Map<string, Row>();
		const dups: Row[] = [];
		for (const row of list) (map.has(keyOf(kind, row)) ? dups : (map.set(keyOf(kind, row), row), [])).push(row);
		return { map, dups };
	};

	const s = index(source);
	const t = index(target);

	for (const key of new Set([...s.map.keys(), ...t.map.keys()])) {
		const sr = s.map.get(key);
		const tr = t.map.get(key);
		const ss = sr ? strip(kind, sr) : undefined;
		const ts = tr ? strip(kind, tr) : undefined;

		const state: RowState = !tr ? 'source_only' : !sr ? 'target_only' : same(ss, ts) ? 'same' : 'changed';
		const row = base(kind.group, kind.kind, key, label((sr ?? tr)!), state);

		if (state === 'source_only') row.source = ss!;
		if (state === 'target_only') row.target = tr!;
		if (state === 'changed') {
			row.source = ss!;
			row.target = tr!;
			row.changes = changesOf(ss!, ts!, kind);
		}

		rows.push(row);
	}

	for (const [side, dups] of [['source', s.dups] as const, ['target', t.dups] as const]) {
		dups.forEach((dup, n) => {
			const key = keyOf(kind, dup);
			const row = base(
				kind.group,
				kind.kind,
				`${key}#${side}${n + 2}`,
				label(dup),
				side === 'source' ? 'source_only' : 'target_only',
			);
			row[side] = dup;
			row.selectable = false;
			row.reason = 'sync_duplicate_key';
			rows.push(row);
		});
	}

	return rows;
}

function deltaState(diff: deepDiff.Diff<unknown, unknown>[]): RowState {
	if (diff.length === 1 && diff[0]!.kind === 'N' && !diff[0]!.path) return 'source_only';
	if (diff.length === 1 && diff[0]!.kind === 'D' && !diff[0]!.path) return 'target_only';
	return 'changed';
}

function deltaChanges(diff: deepDiff.Diff<unknown, unknown>[]): SyncChange[] {
	return diff.map((d) => {
		const path = (d.path ?? []).join('.');
		if (d.kind === 'A')
			return {
				path: `${path}[${d.index}]`,
				source: (d.item as { rhs?: unknown }).rhs ?? null,
				target: (d.item as { lhs?: unknown }).lhs ?? null,
			};
		return { path, source: (d as { rhs?: unknown }).rhs ?? null, target: (d as { lhs?: unknown }).lhs ?? null };
	});
}

function diffSchema(source: Snapshot, target: Snapshot): SyncRow[] {
	const delta = getSnapshotDiff(target, source);
	const rows: SyncRow[] = [];
	const created = new Set<string>();

	for (const { collection, diff } of delta.collections) {
		const state = deltaState(diff);
		const row = base('schema', 'collection', collection, collection, state);

		if (state === 'source_only') {
			created.add(collection);
			const fields = delta.fields
				.filter((f) => f.collection === collection)
				.map((f) => (f.diff[0] as { rhs?: unknown }).rhs);
			row.source = { ...((diff[0] as { rhs?: Row }).rhs ?? {}), fields } as Row;
			const group = ((diff[0] as { rhs?: Row }).rhs?.['meta'] as Row | null)?.['group'];
			if (typeof group === 'string') row.depends.push(rowId('schema', 'collection', group));
		} else if (state === 'target_only') {
			row.target = (diff[0] as { lhs?: Row }).lhs ?? {};
		} else {
			row.changes = deltaChanges(diff);
		}

		rows.push(row);
	}

	for (const { collection, field, diff } of delta.fields) {
		if (created.has(collection)) continue;
		const state = deltaState(diff);
		const key = `${collection}.${field}`;
		const row = base('schema', 'field', key, key, state);
		if (state === 'source_only') row.source = (diff[0] as { rhs?: Row }).rhs ?? {};
		else if (state === 'target_only') row.target = (diff[0] as { lhs?: Row }).lhs ?? {};
		else row.changes = deltaChanges(diff);
		row.depends.push(rowId('schema', 'collection', collection));
		rows.push(row);
	}

	for (const relation of delta.relations) {
		const state = deltaState(relation.diff);
		const key = `${relation.collection}.${relation.field}`;
		const row = base('schema', 'relation', key, key, state);
		if (state === 'source_only') row.source = (relation.diff[0] as { rhs?: Row }).rhs ?? {};
		else if (state === 'target_only') row.target = (relation.diff[0] as { lhs?: Row }).lhs ?? {};
		else row.changes = deltaChanges(relation.diff);
		row.depends.push(rowId('schema', 'collection', relation.collection), rowId('schema', 'field', key));
		if (relation.related_collection) row.depends.push(rowId('schema', 'collection', relation.related_collection));
		rows.push(row);
	}

	return rows;
}

function diffSettings(source: Row | null | undefined, target: Row | null | undefined, ctx: DiffContext): SyncRow[] {
	const rows: SyncRow[] = [];
	const s = source ?? {};
	const t = target ?? {};
	const relations = ctx.schema.relations.filter((r: Relation) => r.collection === 'directus_settings');

	for (const field of new Set([...Object.keys(s), ...Object.keys(t)])) {
		if (field === 'id') continue;
		const state: RowState = same(s[field], t[field]) ? 'same' : 'changed';
		const row = base('settings', 'field', field, field, state);

		if (state === 'changed') {
			row.source = { [field]: s[field] ?? null };
			row.target = { [field]: t[field] ?? null };
			row.changes = [{ path: field, source: s[field] ?? null, target: t[field] ?? null }];

			const value = s[field];
			const related = relations.find((r) => r.field === field)?.related_collection;

			if (
				typeof value === 'string' &&
				related === 'directus_files' &&
				ctx.targetRefs &&
				!ctx.targetRefs.files.has(value)
			) {
				row.selectable = false;
				row.reason = 'sync_file_missing';
			}

			if (typeof value === 'string' && related === 'directus_folders') {
				row.depends.push(rowId('folders', 'folder', value));
				if (ctx.targetRefs && !ctx.targetRefs.folders.has(value)) row.depends.push(`?folders/folder:${value}`);
			}

			if (typeof value === 'string' && related === 'directus_roles') {
				row.depends.push(rowId('access', 'role', value));
				if (ctx.targetRefs && !ctx.targetRefs.roles.has(value)) row.depends.push(`?access/role:${value}`);
			}
		}

		rows.push(row);
	}

	for (const field of hiddenSettingsFields(ctx.schema)) {
		const row = base('settings', 'field', field, field, 'same');
		row.selectable = false;
		row.reason = 'sync_value_hidden';
		rows.push(row);
	}

	return rows;
}

function diffExtensions(source: SyncState['extensions'] = [], target: SyncState['extensions'] = []): SyncRow[] {
	const rows: SyncRow[] = [];
	const t = new Map(target.map((e) => [e.name, e]));
	const s = new Map(source.map((e) => [e.name, e]));

	for (const name of new Set([...s.keys(), ...t.keys()])) {
		const se = s.get(name);
		const te = t.get(name);
		const state: RowState = !te ? 'source_only' : !se ? 'target_only' : se.enabled === te.enabled ? 'same' : 'changed';
		const row = base('extensions', 'extension', name, name, state);
		if (se) row.source = { name, bundle: se.bundle, enabled: se.enabled };
		if (te) row.target = { ...te };
		if (state === 'changed') row.changes = [{ path: 'enabled', source: se!.enabled, target: te!.enabled }];
		if (state === 'source_only' || state === 'target_only') {
			row.selectable = false;
			row.reason = 'sync_extension_missing';
		}

		rows.push(row);
	}

	return rows;
}

const tableState = (state: SyncState, kind: string): Row[] => {
	switch (kind) {
		case 'role':
			return state.access?.roles ?? [];
		case 'policy':
			return state.access?.policies ?? [];
		case 'link':
			return state.access?.links ?? [];
		case 'permission':
			return state.access?.permissions ?? [];
		case 'bo_permission':
			return state.access?.bo_permissions ?? [];
		case 'flow':
			return state.flows ?? [];
		case 'dashboard':
			return state.dashboards ?? [];
		case 'translation':
			return state.translations ?? [];
		case 'preset':
			return state.presets ?? [];
		case 'index':
			return state.indexes ?? [];
		case 'folder':
			return state.folders ?? [];
		default:
			return [];
	}
};

/** Compares the two states of the groups asked for; rows are sorted by group, kind and label. */
export function diffStates(
	source: SyncState,
	target: SyncState,
	groups: readonly GroupKey[],
	ctx: DiffContext,
): SyncRow[] {
	const names = new Map<string, string>();

	for (const row of [
		...tableState(source, 'role'),
		...tableState(target, 'role'),
		...tableState(source, 'policy'),
		...tableState(target, 'policy'),
	]) {
		names.set(String(row['id']), String(row['name'] ?? row['id']));
	}

	const name = (id: unknown) => (id === null || id === undefined ? '(public)' : (names.get(String(id)) ?? String(id)));

	const labels: Record<string, (row: Row) => string> = {
		folder: (r) => String(r['name']),
		role: (r) => String(r['name']),
		policy: (r) => String(r['name']),
		link: (r) => `${name(r['role'])} · ${name(r['policy'])}`,
		permission: (r) => `${name(r['policy'])} · ${r['collection']} · ${r['action']}`,
		bo_permission: (r) => `${name(r['policy'])} · ${r['collection']} · ${r['action']}`,
		translation: (r) => `${r['language']} · ${r['key']}`,
		preset: (r) => `${r['collection']} · ${r['bookmark'] ?? '—'}`,
		flow: (r) => String(r['name']),
		dashboard: (r) => String(r['name']),
		index: (r) => `${r['collection']} · ${r['name']}`,
	};

	let rows: SyncRow[] = [];

	if (groups.includes('schema') && source.schema && target.schema) {
		rows.push(...diffSchema(source.schema as Snapshot, target.schema as Snapshot));
	}

	for (const kind of TABLE_KINDS) {
		if (!groups.includes(kind.group)) continue;
		rows.push(...diffTable(kind, tableState(source, kind.kind), tableState(target, kind.kind), labels[kind.kind]!));
	}

	if (groups.includes('settings')) rows.push(...diffSettings(source.settings, target.settings, ctx));
	if (groups.includes('extensions')) rows.push(...diffExtensions(source.extensions, target.extensions));

	rows = link(rows, target, groups, ctx);

	const order = (row: SyncRow) => `${GROUP_ORDER.indexOf(row.group)}`.padStart(2, '0');
	return rows.sort(
		(a, b) => order(a).localeCompare(order(b)) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
	);
}

const GROUP_ORDER: GroupKey[] = [
	'schema',
	'flows',
	'access',
	'settings',
	'translations',
	'presets',
	'dashboards',
	'indexes',
	'folders',
	'extensions',
];

const isAdminPolicy = (row: Row | undefined) => row?.['admin_access'] === true;

/** Fills `depends`, `cascade`, admin protection and the reasons that follow from them (FR-018, FR-020, FR-027). */
function link(rows: SyncRow[], target: SyncState, groups: readonly GroupKey[], ctx: DiffContext): SyncRow[] {
	const byId = new Map(rows.map((row) => [row.id, row]));
	const row = (r: SyncRow) => (r.source ?? r.target ?? {}) as Row;
	const collectionMissing = (collection: string) =>
		!ctx.schema.collections[collection] && byId.get(rowId('schema', 'collection', collection))?.state !== 'source_only';

	for (const r of rows) {
		if (r.state === 'same' || r.state === 'target_only') continue;
		const data = row(r);
		const needCollection = (collection: unknown) => {
			if (typeof collection !== 'string' || collection.startsWith('directus_') || collection.startsWith('backoffice_'))
				return;
			r.depends.push(rowId('schema', 'collection', collection));
			if (!groups.includes('schema') && collectionMissing(collection))
				r.depends.push(`?schema/collection:${collection}`);
		};

		switch (r.kind) {
			case 'folder':
				if (data['parent']) r.depends.push(rowId('folders', 'folder', String(data['parent'])));
				break;
			case 'role':
				if (data['parent']) r.depends.push(rowId('access', 'role', String(data['parent'])));
				break;
			case 'link':
				if (data['role']) r.depends.push(rowId('access', 'role', String(data['role'])));
				if (data['policy']) r.depends.push(rowId('access', 'policy', String(data['policy'])));
				break;
			case 'permission':
			case 'bo_permission':
				if (data['policy']) r.depends.push(rowId('access', 'policy', String(data['policy'])));
				needCollection(data['collection']);
				break;
			case 'preset':
				needCollection(data['collection']);
				break;
			case 'index':
				needCollection(data['collection']);
				for (const field of (data['fields'] as string[] | undefined) ?? []) {
					r.depends.push(rowId('schema', 'field', `${data['collection']}.${field}`));
				}

				break;
		}

		if (r.kind === 'flow' && r.source) r.impact = { active: r.source['status'] === 'active' };
	}

	// Deletes: admin protection, rows deleted with this one, folders to re-parent first (data-model "Xóa kèm").
	const targetOnly = (kind: string, test: (data: Row) => boolean) =>
		rows.filter((r) => r.kind === kind && r.state === 'target_only' && test(row(r))).map((r) => r.id);

	const adminPolicies = new Set((target.access?.policies ?? []).filter(isAdminPolicy).map((p) => String(p['id'])));
	const adminRoles = new Set(
		(target.access?.links ?? []).filter((l) => adminPolicies.has(String(l['policy']))).map((l) => String(l['role'])),
	);

	for (const r of rows) {
		if (r.state !== 'target_only') continue;
		const data = row(r);
		const id = String(data['id'] ?? '');

		if ((r.kind === 'policy' && isAdminPolicy(data)) || (r.kind === 'role' && adminRoles.has(id))) {
			r.selectable = false;
			r.reason = 'sync_admin_protected';
		}

		if (r.kind === 'collection') {
			const inCollection = (d: Row) => d['collection'] === r.key;
			r.cascade.push(
				...targetOnly('permission', inCollection),
				...targetOnly('bo_permission', inCollection),
				...targetOnly('preset', inCollection),
				...targetOnly('index', inCollection),
			);
		}

		if (r.kind === 'policy') {
			const ofPolicy = (d: Row) => String(d['policy']) === id;
			r.cascade.push(
				...targetOnly('permission', ofPolicy),
				...targetOnly('bo_permission', ofPolicy),
				...targetOnly('link', ofPolicy),
			);
		}

		if (r.kind === 'role') r.cascade.push(...targetOnly('link', (d) => String(d['role']) === id));

		if (r.kind === 'folder') {
			const closure = (parent: string): string[] =>
				rows
					.filter((c) => c.kind === 'folder' && c.state === 'target_only' && String(row(c)['parent']) === parent)
					.flatMap((c) => [c.id, ...closure(String(row(c)['id']))]);

			r.cascade.push(...closure(id));
			// A child folder kept by the source under another parent must be moved first (FK without ON DELETE).
			for (const c of rows) {
				if (c.kind === 'folder' && c.state === 'changed' && String(c.target?.['parent']) === id) r.depends.push(c.id);
			}
		}
	}

	// Keep the dependencies that still need applying; an unknown one ("?…") or a blocked one blocks the row.
	for (const r of rows) {
		const blocked = r.depends.filter((d) => d.startsWith('?'));
		r.depends = [
			...new Set(r.depends.filter((d) => !d.startsWith('?') && byId.has(d) && byId.get(d)!.state !== 'same')),
		];
		r.cascade = [...new Set(r.cascade)];

		if (r.selectable && blocked.length > 0) {
			r.selectable = false;
			r.reason = 'sync_needs_row';
		}
	}

	// A row is blocked when one of its dependencies or cascaded rows cannot be ticked (until nothing changes).
	for (let changed = true; changed; ) {
		changed = false;
		for (const r of rows) {
			if (!r.selectable) continue;
			const blocker = [...r.depends, ...r.cascade].map((d) => byId.get(d)!).find((d) => !d.selectable);
			if (blocker) {
				r.selectable = false;
				r.reason = blocker.reason === 'sync_admin_protected' ? 'sync_admin_protected' : 'sync_needs_row';
				changed = true;
			}
		}
	}

	return rows;
}

/** Normalized states for the hash: the ignored columns and the per-instance extension ids are left out (FR-022). */
export function hashStates(source: SyncState, target: SyncState, groups: readonly GroupKey[]): string {
	const normalize = (state: SyncState) => {
		const out: Record<string, unknown> = {};
		for (const group of groups) out[group] = null;
		if (state.schema) out['schema'] = state.schema;
		for (const kind of TABLE_KINDS) {
			if (groups.includes(kind.group))
				out[`${kind.group}.${kind.kind}`] = tableState(state, kind.kind).map((r) => strip(kind, r));
		}

		if (groups.includes('settings')) out['settings'] = state.settings ?? null;
		if (groups.includes('extensions')) out['extensions'] = (state.extensions ?? []).map(({ id: _id, ...rest }) => rest);
		return out;
	};

	return getVersionedHash({ source: normalize(source), target: normalize(target) });
}
