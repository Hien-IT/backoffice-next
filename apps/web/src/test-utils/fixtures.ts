// Fixture snapshot of feature 013 (apps/web/fixtures/interfaces/snapshot, data-model §6): configuration and data
// written by DR 11.17.4, loaded by component tests and served by mockFixtureApi (fetch.ts).
import type { CollectionAccess, FieldRaw, FlowRaw, Relation } from '@directus/types';

export type FixtureUser = 'admin' | 'bo-editor' | 'bo-viewer';
export type Row = Record<string, any>;

export interface FixtureAccount {
	/** `GET /users/me?fields=*,role.id,role.name` of the user. */
	me: Row & { id: string; role: { id: string; name: string } | null };
	/** `GET /policies/me/globals`. */
	globals: { app_access: boolean; admin_access: boolean; enforce_tfa: boolean };
}

/** One scenario of an `expected.<interface>.json` file: the value DR emits and where that comes from. */
export interface ExpectedScenario {
	value: unknown;
	/** DR code line or test the value comes from (FR-100, CHK051). */
	source: string;
	description?: string;
}

export interface Snapshot {
	meta: { api: string; version: string; date: string; geometry: boolean };
	collections: Row[];
	fields: FieldRaw[];
	relations: Relation[];
	/** Configuration of directus_files, directus_folders and directus_users, which bo_* fields point at. */
	systemCollections: Row[];
	systemFields: FieldRaw[];
	files: Row[];
	flows: FlowRaw[];
	/** Rows of every bo_* collection as `fields=*.*` returned them (relations expanded one level). */
	items: Record<string, Row[]>;
	permissions: Record<FixtureUser, CollectionAccess>;
	users: Record<FixtureUser, FixtureAccount>;
	/** `expected.<interface>.json`, keyed by interface id then scenario. */
	expected: Record<string, Record<string, ExpectedScenario>>;
	/** Feature 014: presets and bookmarks, versions, shares, comments of bo_* and the revisions of bo_content/1. */
	presets: Row[];
	versions: Row[];
	shares: Row[];
	comments: Row[];
	revisions: Record<string, Row[]>;
	/** `expected.content.json`: values recorded on the DR app for the Content module (not an interface). */
	contentExpected: Record<string, any>;
	/** Feature 015: the bo-files folder tree, its files, the roles and the directory users (data-model §11). */
	directoryFolders: Row[];
	directoryFiles: Row[];
	roles: Row[];
	directoryUsers: Row[];
	/** Feature 017 (data-model §9): the flows of the editor set, their operations, the steps of the bo_all_ops runs. */
	editorFlows: FlowRaw[];
	operations: Row[];
	flowRuns: { reason: string; steps: { operation: string; key: string; status: string }[] }[];
	/** Feature 018 (data-model §12): the bo_dash_* dashboards, their panels, the admin notifications, some activity. */
	dashboards: Row[];
	panels: Row[];
	notifications: Row[];
	activity: Row[];
}

const files = import.meta.glob<unknown>('../../fixtures/interfaces/snapshot/*.json', {
	eager: true,
	import: 'default',
});

const byName = Object.fromEntries(
	Object.entries(files).map(([path, value]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), value]),
);

function prefixed<T>(prefix: string): Record<string, T> {
	return Object.fromEntries(
		Object.entries(byName)
			.filter(([name]) => name.startsWith(prefix))
			.map(([name, value]) => [name.slice(prefix.length), value as T]),
	);
}

const snapshot = {
	meta: byName['meta'],
	collections: byName['collections'],
	fields: byName['fields'],
	relations: byName['relations'],
	systemCollections: byName['collections.system'] ?? [],
	systemFields: byName['fields.system'] ?? [],
	files: byName['files'],
	flows: byName['flows'],
	items: prefixed<Row[]>('items.'),
	permissions: prefixed<CollectionAccess>('permissions.'),
	users: byName['users'],
	expected: Object.fromEntries(
		Object.entries(prefixed<Record<string, ExpectedScenario>>('expected.')).filter(([id]) => id !== 'content'),
	),
	presets: byName['presets'] ?? [],
	versions: byName['versions'] ?? [],
	shares: byName['shares'] ?? [],
	comments: byName['comments'] ?? [],
	revisions: prefixed<Row[]>('revisions.'),
	contentExpected: byName['expected.content'] ?? {},
	directoryFolders: byName['folders'] ?? [],
	directoryFiles: byName['files.directory'] ?? [],
	roles: byName['roles'] ?? [],
	directoryUsers: byName['users.directory'] ?? [],
	editorFlows: byName['flows.editor'] ?? [],
	operations: byName['operations'] ?? [],
	flowRuns: byName['flows.runs'] ?? [],
	dashboards: byName['dashboards'] ?? [],
	panels: byName['panels'] ?? [],
	notifications: byName['notifications'] ?? [],
	activity: byName['activity'] ?? [],
} as Snapshot;

/** A fresh copy of the snapshot (tests may change it freely). */
export function loadSnapshot(): Snapshot {
	return structuredClone(snapshot);
}

/** Raw fields (`GET /fields` rows) of a collection, in form order. */
export function fieldsOf(collection: string): FieldRaw[] {
	const fields = collection.startsWith('directus_') ? snapshot.systemFields : snapshot.fields;
	const result = fields.filter((field) => field.collection === collection);
	if (result.length === 0) throw new Error(`No fixture fields for ${collection}`);
	return structuredClone(result);
}

/** Relations where the collection is the many side or the one side. */
export function relationsOf(collection: string): Relation[] {
	return structuredClone(
		snapshot.relations.filter((r) => r.collection === collection || r.related_collection === collection),
	);
}

/** A fixture row by primary key, as `fields=*.*` returned it. */
export function itemOf(collection: string, id: string | number): Row {
	const pk = fieldsOf(collection).find((field) => field.schema?.is_primary_key)?.field ?? 'id';
	const row = snapshot.items[collection]?.find((item) => item[pk] === id);
	if (!row) throw new Error(`No fixture item ${collection}/${id}`);
	return structuredClone(row);
}

/** The expected value of an edit scenario (`expected.<interfaceId>.json`). */
export function expected(interfaceId: string, scenario: string): unknown {
	const entry = snapshot.expected[interfaceId]?.[scenario];
	if (!entry) throw new Error(`No expected value ${interfaceId}/${scenario}`);
	return structuredClone(entry.value);
}
