import { vi } from 'vitest';
import { createSdk } from '../api/sdk.ts';
import type { FixtureUser, Row, Snapshot } from './fixtures.ts';

export const API = 'http://api.test/';

type Answer = unknown | ((request: { url: URL; init: RequestInit }) => Response | Promise<Response>);

export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const notFound = () => json({ errors: [{ message: 'Not found', extensions: { code: 'ROUTE_NOT_FOUND' } }] }, 404);

/** Stubs the global fetch with `handler` and creates the SDK on http://api.test/. */
function stubFetch(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
	const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
		handler(new URL(input instanceof Request ? input.url : String(input)), init),
	);

	vi.stubGlobal('fetch', fetch);
	createSdk(API);

	return fetch;
}

/**
 * Stubs the global fetch and creates the SDK on http://api.test/. `answers` maps "METHOD /path" (query ignored) to
 * a `data` value or a function returning a Response; anything else answers 404. Returns the fetch mock.
 */
export function mockApi(answers: Record<string, Answer>) {
	return stubFetch((url, init) => {
		const answer = answers[`${init.method ?? 'GET'} ${url.pathname}`];

		if (answer === undefined) return notFound();
		if (typeof answer === 'function') return answer({ url, init });
		return json({ data: answer });
	});
}

/** "METHOD /path?query" of every call of a fetch mock, in order. */
export function calls(fetch: ReturnType<typeof mockApi>): string[] {
	return fetch.mock.calls.map(([input, init]) => {
		const url = new URL(String(input));
		return `${init?.method ?? 'GET'} ${decodeURIComponent(url.pathname + url.search)}`;
	});
}

/* ------------------------------------------------------------------------------------------------ allowed requests */

const ID = '[^/]+';

/**
 * The closed list of API requests of the web app: specs/012-backoffice-web-shell/contracts/api-calls.md (#1-#32) and
 * specs/013-interfaces-displays/contracts/api-calls.md (#33-#49), 014 (#50-#96) and 015 (rows 97 to 134), on method and path
 * (query ignored). Same idea as
 * apps/web-e2e/src/helpers/allowed-paths.ts, which only lists what the 012 pages send.
 */
export const KNOWN_REQUESTS: { id: number; method: string; path: RegExp }[] = [
	{ id: 1, method: 'GET', path: /^\/server\/info$/ },
	{ id: 2, method: 'GET', path: /^\/auth$/ },
	{ id: 3, method: 'POST', path: /^\/auth\/login$/ },
	{ id: 4, method: 'POST', path: new RegExp(`^/auth/login/${ID}$`) },
	{ id: 6, method: 'POST', path: /^\/auth\/refresh$/ },
	{ id: 7, method: 'POST', path: /^\/auth\/logout$/ },
	{ id: 8, method: 'POST', path: /^\/auth\/password\/request$/ },
	{ id: 9, method: 'POST', path: /^\/auth\/password\/reset$/ },
	{ id: 10, method: 'POST', path: /^\/users\/invite\/accept$/ },
	{ id: 11, method: 'POST', path: /^\/server\/setup$/ },
	{ id: 12, method: 'GET', path: /^\/users\/me$/ },
	{ id: 14, method: 'PATCH', path: /^\/users\/me$/ },
	{ id: 15, method: 'POST', path: /^\/users\/me\/tfa\/generate$/ },
	{ id: 16, method: 'POST', path: /^\/users\/me\/tfa\/enable$/ },
	{ id: 17, method: 'GET', path: /^\/policies\/me\/globals$/ },
	{ id: 18, method: 'GET', path: /^\/roles\/me$/ },
	{ id: 19, method: 'GET', path: /^\/permissions\/me$/ },
	{ id: 20, method: 'GET', path: /^\/settings$/ },
	{ id: 21, method: 'GET', path: /^\/collections$/ },
	{ id: 22, method: 'GET', path: /^\/fields$/ },
	{ id: 23, method: 'GET', path: /^\/relations$/ },
	{ id: 24, method: 'GET', path: /^\/presets$/ },
	{ id: 25, method: 'GET', path: /^\/translations$/ },
	{ id: 26, method: 'GET', path: /^\/notifications$/ },
	// 27 (012 images), 41 (display/interface thumbnails) and 42 (`<id>.<ext>` in rich text and markdown).
	{ id: 27, method: 'GET', path: new RegExp(`^/assets/${ID}$`) },
	{ id: 28, method: 'GET', path: new RegExp(`^/shares/info/${ID}$`) },
	{ id: 29, method: 'POST', path: /^\/shares\/auth$/ },
	// 30 (avatar) and 45 (BoUpload).
	{ id: 30, method: 'POST', path: /^\/files$/ },
	{ id: 31, method: 'POST', path: /^\/utils\/resolve-redirect$/ },
	{ id: 32, method: 'PATCH', path: /^\/users\/me\/track\/page$/ },
	{ id: 33, method: 'GET', path: /^\/flows$/ },
	// 34-37, 39, 40: lists through useItems / useRelation* on getEndpoint(collection).
	{ id: 34, method: 'GET', path: new RegExp(`^/items/${ID}$`) },
	{ id: 40, method: 'GET', path: /^\/(files|users|folders)$/ },
	// 38 (`presentation-links`, `header`) and 49 (user popover).
	{ id: 38, method: 'GET', path: new RegExp(`^/items/${ID}/${ID}$`) },
	{ id: 49, method: 'GET', path: new RegExp(`^/(users|files)/${ID}$`) },
	{ id: 47, method: 'POST', path: /^\/files\/import$/ },
	{ id: 48, method: 'POST', path: new RegExp(`^/flows/trigger/${ID}$`) },
	// Feature 014 (specs/014-content-module/contracts/api-calls.md #50-#96).
	{ id: 53, method: 'GET', path: new RegExp(`^/permissions/me/${ID}(/${ID})?$`) },
	{ id: 55, method: 'GET', path: /^\/(revisions|versions|comments|shares)$/ },
	{ id: 56, method: 'GET', path: new RegExp(`^/(revisions|versions|shares)/${ID}$`) },
	{ id: 58, method: 'GET', path: new RegExp(`^/versions/${ID}/compare$`) },
	{ id: 70, method: 'POST', path: new RegExp(`^/(items/${ID}|presets|versions|comments|shares)$`) },
	{
		id: 71,
		method: 'PATCH',
		path: new RegExp(`^/(items/${ID}(/${ID})?|presets/${ID}|versions/${ID}|comments/${ID}|shares/${ID})$`),
	},
	{
		id: 73,
		method: 'DELETE',
		path: new RegExp(`^/(items/${ID}(/${ID})?|presets|versions/${ID}|comments/${ID}|shares/${ID})$`),
	},
	{ id: 75, method: 'POST', path: new RegExp(`^/utils/(sort|export|import)/${ID}$`) },
	{ id: 82, method: 'POST', path: new RegExp(`^/versions/${ID}/(save|promote)$`) },
	{ id: 90, method: 'POST', path: /^\/shares\/invite$/ },
	{ id: 93, method: 'POST', path: /^\/graphql(\/system)?$/ },
	{ id: 94, method: 'SEARCH', path: new RegExp(`^/items/${ID}$`) },
	// Feature 015 (specs/015-files-users-modules/contracts/api-calls.md, rows 97 to 134).
	{ id: 98, method: 'GET', path: new RegExp(`^/folders/${ID}$`) },
	{ id: 103, method: 'GET', path: /^\/roles$/ },
	{ id: 105, method: 'GET', path: /^\/utils\/random\/string$/ },
	{ id: 110, method: 'POST', path: /^\/(folders|users|users\/invite)$/ },
	{ id: 111, method: 'PATCH', path: new RegExp(`^/(folders|files|users)(/${ID})?$`) },
	// Not /users/me: the app deletes the current user by its id (Directus users/routes/item.vue).
	{ id: 113, method: 'DELETE', path: new RegExp(`^/(folders|files|users)(/(?!me$)${ID})?$`) },
	{ id: 120, method: 'POST', path: /^\/files\/tus$/ },
	{ id: 120, method: 'PATCH', path: new RegExp(`^/files/tus/${ID}$`) },
	{ id: 120, method: 'HEAD', path: new RegExp(`^/files/tus/${ID}$`) },
	{ id: 120, method: 'DELETE', path: new RegExp(`^/files/tus/${ID}$`) },
	{ id: 121, method: 'POST', path: new RegExp(`^/assets/(files|folder/${ID})$`) },
	{ id: 130, method: 'POST', path: new RegExp(`^/users/(me|${ID})/tfa/disable$`) },
];

/**
 * Throws when a call of `calls(fetch)` is not in KNOWN_REQUESTS (FR-054, FR-081, SC-007). `extra` allows more paths
 * for one test, for example the external URL of `input-autocomplete-api` (#43).
 */
export function assertOnlyKnownRequests(list: string[], extra: RegExp[] = []): void {
	const unknown = list.filter((call) => {
		const [method, target = ''] = call.split(' ');
		const path = target.split('?')[0]!;
		return !KNOWN_REQUESTS.some((r) => r.method === method && r.path.test(path)) && !extra.some((r) => r.test(path));
	});

	if (unknown.length > 0) throw new Error(`Requests outside contracts/api-calls.md:\n${unknown.join('\n')}`);
}

/* ------------------------------------------------------------------------------------------------ fixture API */

// 1x1 transparent PNG served for every /assets/<id>.
const PNG = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
	(c) => c.charCodeAt(0),
);

const ENDPOINTS: Record<string, string> = {
	files: 'directus_files',
	users: 'directus_users',
	folders: 'directus_folders',
	flows: 'directus_flows',
	presets: 'directus_presets',
	translations: 'directus_translations',
	notifications: 'directus_notifications',
	// Feature 014 (contracts/api-calls.md #50-#96).
	versions: 'directus_versions',
	shares: 'directus_shares',
	comments: 'directus_comments',
	revisions: 'directus_revisions',
	// Feature 015.
	roles: 'directus_roles',
};

class ApiError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const forbidden = (message = "You don't have permission to access this.") => new ApiError(403, 'FORBIDDEN', message);

export interface FixtureApiOptions {
	/** Whose permissions, `/users/me` and `/policies/me/globals` the API answers with (default `admin`). */
	user?: FixtureUser;
	/** "METHOD /path" overrides, checked first (same shape as mockApi). */
	answers?: Record<string, Answer>;
	/** Merged into the `/server/info` answer (feature 015: `uploads`, `project`). */
	serverInfo?: Record<string, unknown>;
}

/**
 * Stubs fetch with an in-memory API over the fixture snapshot (contracts/tests.md §3): hydrate routes, lists of
 * `/items/<c>`, `/files`, `/users`, `/flows` with `filter` (`_eq` and its `{ field: value }` shorthand, `_neq`, `_in`,
 * `_nin`, `_null`, `_nnull`, `_or`, `_and`, `_some` / `_none` on o2m, m2m and `$FOLLOW(...)` and a few more), `search`, `sort`, `limit`, `page`, `fields` (nested), `alias` and `aggregate`;
 * `/assets/<id>` (1x1 PNG), `POST /files` and `POST /files/import` (add a file row), `POST /flows/trigger/<id>`.
 * Feature 015: the bo-files folders, files, roles and directory users; `PATCH /files/<id>` multipart (replace),
 * `POST /assets/files|folder/<id>` (a zip), `POST /users/invite`, the TFA routes of `/users`, `GET /utils/random/string`.
 * Read permissions of the user apply like Directus: an explicit field or collection the user cannot read answers 403,
 * `*` lists the readable fields. Returns the fetch mock; `fetch.db` holds the rows (flat, keys instead of objects).
 */
export function mockFixtureApi(
	source: Snapshot,
	{ user = 'admin', answers = {}, serverInfo = {} }: FixtureApiOptions = {},
) {
	const snapshot = structuredClone(source);
	const account = snapshot.users[user];
	const isAdmin = account.globals.admin_access;
	const permissions = snapshot.permissions[user] as Record<string, any>;
	const allFields = [...snapshot.systemFields, ...snapshot.fields];
	const relations = snapshot.relations;

	const fieldsOf = (collection: string) => allFields.filter((f) => f.collection === collection);
	const pkOf = (collection: string) => fieldsOf(collection).find((f) => f.schema?.is_primary_key)?.field ?? 'id';

	/** The collection a field points at: m2o (and m2a by the row's collection field) or o2m. */
	function relationOf(
		collection: string,
		field: string,
		row?: Row,
	): { kind: 'm2o' | 'o2m'; collection: string; field?: string } | null {
		const many = relations.find((r) => r.collection === collection && r.field === field);

		if (many?.related_collection) return { kind: 'm2o', collection: many.related_collection };
		if (many?.meta?.one_collection_field)
			return row?.[many.meta.one_collection_field]
				? { kind: 'm2o', collection: row[many.meta.one_collection_field] }
				: null;

		const one = relations.find((r) => r.related_collection === collection && r.meta?.one_field === field);
		return one ? { kind: 'o2m', collection: one.collection, field: one.field } : null;
	}

	/** A `fields=*.*` row of the snapshot back to what the database holds: keys instead of related objects. */
	function flatten(collection: string, row: Row): Row {
		return Object.fromEntries(
			Object.entries(row).map(([key, value]) => {
				const relation = relationOf(collection, key, row);
				if (!relation || value === null || typeof value !== 'object') return [key, value];
				const pk = pkOf(relation.collection);
				if (Array.isArray(value)) return [key, value.map((v) => (v && typeof v === 'object' ? v[pk] : v))];
				return [key, value[pk]];
			}),
		);
	}

	const db: Record<string, Row[]> = {
		...Object.fromEntries(Object.entries(snapshot.items).map(([c, rows]) => [c, rows.map((r) => flatten(c, r))])),
		directus_files: [...snapshot.files, ...(snapshot.directoryFiles ?? [])].map((r) => flatten('directus_files', r)),
		directus_users: [
			...Object.values(snapshot.users).map(({ me }) => ({ ...me, role: me.role?.id ?? null })),
			...(snapshot.directoryUsers ?? []),
		],
		directus_folders: [
			...[...new Set(snapshot.files.map((f) => f['folder']))].map((id) => ({
				id,
				name: 'bo-fixtures',
				parent: null,
			})),
			...(snapshot.directoryFolders ?? []),
		],
		directus_roles: (snapshot.roles ?? []) as Row[],
		directus_flows: snapshot.flows as Row[],
		directus_presets: (snapshot.presets ?? []) as Row[],
		directus_translations: [],
		directus_notifications: [],
		directus_versions: (snapshot.versions ?? []) as Row[],
		directus_shares: (snapshot.shares ?? []) as Row[],
		directus_comments: (snapshot.comments ?? []) as Row[],
		directus_revisions: Object.values(snapshot.revisions ?? {}).flat() as Row[],
	};

	/* ---------------------------------------------------------------- permissions */

	function readable(collection: string): string[] | '*' {
		if (isAdmin) return '*';
		const read = permissions[collection]?.read;
		if (!read || read.access === 'none') throw forbidden();
		return read.fields.includes('*') ? '*' : read.fields;
	}

	function checkField(collection: string, field: string) {
		const allowed = readable(collection);

		if (allowed !== '*' && !allowed.includes(field))
			throw forbidden(
				`You don't have permission to access field "${field}" in collection "${collection}" or it does not exist.`,
			);
	}

	function rowsOf(collection: string): Row[] {
		readable(collection);
		const rows = db[collection] ?? [];
		// shortcut: the only partial row filter the fixture users have is the app-access one on their own user.
		if (!isAdmin && collection === 'directus_users' && permissions[collection].read.access === 'partial')
			return rows.filter((r) => r['id'] === account.me.id);
		return rows;
	}

	const find = (collection: string, key: unknown) =>
		rowsOf(collection).find((r) => loose(r[pkOf(collection)], key)) ?? null;

	/* ---------------------------------------------------------------- filter, search, sort */

	const variable = (value: unknown) =>
		value === '$CURRENT_USER' ? account.me.id : value === '$CURRENT_ROLE' ? (account.me.role?.id ?? null) : value;

	function matches(collection: string, row: Row, filter: unknown): boolean {
		if (!filter || typeof filter !== 'object') return true;

		return Object.entries(filter as Record<string, any>).every(([key, value]) => {
			if (key === '_and') return (value as unknown[]).every((f) => matches(collection, row, f));
			if (key === '_or') return (value as unknown[]).some((f) => matches(collection, row, f));

			// `$FOLLOW(collection,field[,collectionField])`: the rows of `collection` whose `field` points at this row
			// (Directus getRelationInfo: an implicit o2m, or o2a with the collection field), filtered like an o2m.
			if (key.startsWith('$FOLLOW(') && key.endsWith(')')) {
				const [follow, field, collectionField] = key
					.slice(8, -1)
					.split(',')
					.map((part) => part.trim()) as [string, string, string | undefined];
				checkField(follow, field);
				const pk = row[pkOf(collection)];
				const related = rowsOf(follow).filter(
					(r) => loose(r[field], pk) && (collectionField === undefined || r[collectionField] === collection),
				);
				return quantified(follow, related, value);
			}

			checkField(collection, key);
			// Shorthand `{ field: value }` means `_eq`, as the API reads it (sent by use-relation-multiple).
			if (value === null || typeof value !== 'object') return compare('_eq', row[key], variable(value));
			const relation = relationOf(collection, key, row);
			const operators = Object.keys(value ?? {});

			if (relation && operators.some((op) => !op.startsWith('_') || op === '_some' || op === '_none')) {
				if (relation.kind === 'm2o') {
					const related = row[key] == null ? null : find(relation.collection, row[key]);
					return related !== null && matches(relation.collection, related, value);
				}

				// o2m (and the junction rows of m2m / m2a): the rows whose foreign key points at this row.
				const pk = row[pkOf(collection)];
				const related = rowsOf(relation.collection).filter((r) => loose(r[relation.field!], pk));
				return quantified(relation.collection, related, value);
			}

			return Object.entries(value as Record<string, unknown>).every(([op, arg]) =>
				compare(op, row[key], variable(arg)),
			);
		});
	}

	/** `_none` / `_some` (the default) of a to-many filter over the related rows. */
	function quantified(collection: string, related: Row[], value: Record<string, any>): boolean {
		if ('_none' in value) return !related.some((r) => matches(collection, r, value['_none']));
		return related.some((r) => matches(collection, r, value['_some'] ?? value));
	}

	function searched(collection: string, rows: Row[], search: string | null): Row[] {
		if (!search) return rows;
		const allowed = readable(collection);
		const numeric = search.trim() !== '' && !Number.isNaN(Number(search));

		const fields = fieldsOf(collection).filter((f) => allowed === '*' || allowed.includes(f.field));

		return rows.filter((row) =>
			fields.some(({ field, type }) => {
				const value = row[field];
				if (value == null) return false;
				if (type === 'string' || type === 'text') return String(value).toLowerCase().includes(search.toLowerCase());
				if (['integer', 'bigInteger', 'float', 'decimal'].includes(type))
					return numeric && Number(value) === Number(search);
				if (type === 'uuid') return String(value) === search;
				return false;
			}),
		);
	}

	/* ---------------------------------------------------------------- fields */

	function project(collection: string, row: Row, list: string[], alias: Record<string, string> = {}): Row {
		const groups = new Map<string, string[]>();
		const add = (key: string, rest: string[]) => {
			const sub = groups.get(key) ?? [];
			if (rest.length > 0) sub.push(rest.join('.'));
			groups.set(key, sub);
		};

		for (const entry of list) {
			const [head, ...rest] = entry.split('.');

			if (head === '*') {
				const allowed = readable(collection);

				for (const key of Object.keys(row)) {
					if (allowed !== '*' && !allowed.includes(key)) continue;
					add(key, relationOf(collection, key, row) ? rest : []);
				}
			} else if (!head!.startsWith('$')) {
				add(head!, rest);
			}
		}

		const out: Row = {};

		for (const [key, sub] of groups) {
			const [name, scope] = key.split(':') as [string, string | undefined];
			const real = alias[name] ?? name;
			checkField(collection, real);
			if (!(real in row)) continue;

			const relation = relationOf(collection, real, row);
			const value = row[real];

			if (scope !== undefined && relation?.collection !== scope) {
				if (!(name in out)) out[name] = value;
				continue;
			}

			if (!relation || sub.length === 0 || value == null) {
				out[name] = value;
			} else if (relation.kind === 'm2o') {
				const related = find(relation.collection, value);
				out[name] = related ? project(relation.collection, related, sub) : null;
			} else {
				out[name] = (value as unknown[])
					.map((k) => find(relation.collection, k))
					.filter(Boolean)
					.map((r) => project(relation.collection, r!, sub));
			}
		}

		return out;
	}

	/* ---------------------------------------------------------------- routes */

	function list(collection: string, url: URL): unknown {
		const params = url.searchParams;
		const filter = param(url, 'filter');
		let rows = rowsOf(collection).filter((row) => matches(collection, row, filter));
		rows = searched(collection, rows, params.get('search'));

		const aggregate = param(url, 'aggregate') as Record<string, unknown> | undefined;
		if (aggregate) return [aggregated(rows, aggregate)];

		const sort = params.get('sort');
		if (sort) rows = [...rows].sort(sorter(sort.split(',')));

		const limit = Number(params.get('limit') ?? 100);
		const offset = Number(params.get('offset') ?? 0) + (Number(params.get('page') ?? 1) - 1) * Math.max(limit, 0);
		rows = limit === -1 ? rows.slice(offset) : rows.slice(offset, offset + limit);

		const fields = fieldList(url);
		const alias = (param(url, 'alias') ?? {}) as Record<string, string>;
		return rows.map((row) => project(collection, row, fields, alias));
	}

	function one(collection: string, key: string, url: URL): unknown {
		const row = find(collection, decodeURIComponent(key));
		if (!row) throw forbidden();
		return project(collection, row, fieldList(url), (param(url, 'alias') ?? {}) as Record<string, string>);
	}

	let created = 0;

	function createFile(data: Row): Row {
		created++;
		const id = `bo-new-${created}`;

		const row = {
			id,
			storage: 'local',
			filename_disk: null,
			filename_download: data['filename_download'] ?? `upload-${created}`,
			title: data['title'] ?? null,
			type: data['type'] ?? 'application/octet-stream',
			folder: data['folder'] ?? null,
			uploaded_by: account.me.id,
			created_on: null,
			modified_by: null,
			modified_on: null,
			filesize: String(data['filesize'] ?? 0),
			width: null,
			height: null,
			...Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'file')),
		};

		db['directus_files']!.push(row);
		return row;
	}

	async function route(url: URL, init: RequestInit): Promise<unknown> {
		const method = init.method ?? 'GET';
		const path = url.pathname;
		const [, first, second, third] = path.split('/') as [string, string, string?, string?];

		if (method === 'GET') {
			if (path === '/server/info')
				return {
					project: null,
					setupCompleted: true,
					websocket: false,
					queryLimit: { default: 100, max: -1 },
					files: { mimeTypeAllowList: ['*/*'] },
					...serverInfo,
				};
			if (path === '/users/me') return project('directus_users', { ...account.me }, fieldList(url));
			if (path === '/policies/me/globals') return account.globals;
			if (path === '/roles/me') return account.me.role ? [{ id: account.me.role.id }] : [];
			if (path === '/permissions/me') return permissions;
			if (path === '/settings')
				return {
					module_bar: null,
					basemaps: null,
					mapbox_key: null,
					storage_asset_transform: 'all',
					storage_asset_presets: null,
				};
			if (path === '/collections') return [...snapshot.systemCollections, ...snapshot.collections];
			if (path === '/fields') return allFields;
			if (path === '/relations') return relations;
			if (first === 'assets' && second) return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
			// 015: token generation (row 105).
			if (path === '/utils/random/string') return `bo-random-${++serial}`;
			// 014: item permissions (#53), version comparison (#58), singleton reads, export download (#63).
			if (first === 'permissions' && second === 'me' && third) return itemPermissions(third);
			if (first === 'versions' && second && third === 'compare') return compareVersion(second);
			if (first === 'items' && second && !third && isSingleton(second)) return singleton(second, url);
			if (first === 'items' && second && !third && url.searchParams.has('export')) return exported(second, url);
			if (first === 'items' && second && !third) return list(second, url);
			if (first === 'items' && second && third) return one(second, third, url);
			if (ENDPOINTS[first] && !second) return list(ENDPOINTS[first]!, url);
			if (ENDPOINTS[first] && second && !third) return one(ENDPOINTS[first]!, second, url);
		}

		if (method === 'POST' && path === '/files') {
			const form = init.body as FormData;
			const file = form.get('file') as File | null;
			const data: Row = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
			return createFile({
				...data,
				filename_download: file?.name,
				type: file?.type || undefined,
				filesize: file?.size,
			});
		}

		/* -------------------------------------------------------------- 015 (rows 97 to 134) */

		// Replace the file of a row (multipart PATCH, FR-033) or edit it from the image editor (FR-043).
		if (method === 'PATCH' && first === 'files' && second && init.body instanceof FormData) {
			const file = init.body.get('file') as File | null;
			const data: Row = Object.fromEntries([...init.body.entries()].filter(([, v]) => typeof v === 'string'));
			return update('directus_files', decodeURIComponent(second), {
				...data,
				...(file && { filename_download: file.name, type: file.type || null, filesize: String(file.size) }),
			});
		}

		if (method === 'POST' && first === 'assets' && (second === 'files' || (second === 'folder' && third)))
			return new Response('PK-zip', {
				headers: {
					'Content-Type': 'application/zip',
					'Content-Disposition': `attachment; filename="${second === 'files' ? 'files' : 'folder'}.zip"`,
				},
			});

		if (method === 'POST' && path === '/users/invite') return inviteUsers(JSON.parse(String(init.body)));

		if (method === 'POST' && path === '/users/me/tfa/generate')
			return { secret: 'BOSECRETBOSECRET', otpauth_url: 'otpauth://totp/Backoffice:admin?secret=BOSECRETBOSECRET' };
		if (method === 'POST' && path === '/users/me/tfa/enable') return null;
		if (method === 'POST' && first === 'users' && second && path.endsWith('/tfa/disable')) {
			if (second !== 'me') update('directus_users', decodeURIComponent(second), { tfa_secret: null });
			return null;
		}

		if (method === 'POST' && path === '/files/import') {
			const body = JSON.parse(String(init.body)) as { url: string; data?: Row };
			return createFile({ filename_download: body.url.split('/').pop(), ...body.data });
		}

		// Directus answers a manual flow without operations with the trigger data ($trigger).
		if (method === 'POST' && first === 'flows' && second === 'trigger' && third)
			return { path: `/trigger/${third}`, query: {}, body: JSON.parse(String(init.body ?? '{}')), method, headers: {} };

		/* -------------------------------------------------------------- 014 writes (#70-#96) */

		const body = () => (typeof init.body === 'string' && init.body ? JSON.parse(init.body) : null);

		if (method === 'POST' && first === 'versions' && second && third === 'save') return saveVersion(second, body());
		if (method === 'POST' && first === 'versions' && second && third === 'promote')
			return promoteVersion(second, body());
		if (method === 'POST' && first === 'utils' && second === 'sort' && third) return sortItems(third, body());
		if (method === 'POST' && first === 'utils' && (second === 'export' || second === 'import') && third) return null;
		if (method === 'POST' && first === 'shares' && second === 'invite') return null;
		if (method === 'POST' && first === 'graphql') return graphqlById(body()?.query ?? '');
		if (method === 'SEARCH' && first === 'items' && second) return list(second, url);

		const collection = first === 'items' ? second : first ? ENDPOINTS[first] : undefined;
		const key = first === 'items' ? third : second;

		if (collection && ['POST', 'PATCH', 'DELETE'].includes(method)) {
			if (method === 'POST' && !key) {
				const data = body();
				return Array.isArray(data) ? data.map((row) => create(collection, row)) : create(collection, data);
			}

			if (method === 'PATCH' && key) return update(collection, decodeURIComponent(key), body());

			if (method === 'PATCH' && !key) {
				const data = body();
				if (isSingleton(collection)) return update(collection, rowsOf(collection)[0]?.[pkOf(collection)], data);
				if (Array.isArray(data)) return data.map((row) => update(collection, row[pkOf(collection)], row));
				return (data.keys as unknown[]).map((k) => update(collection, k, data.data));
			}

			if (method === 'DELETE') {
				const keys = key ? [decodeURIComponent(key)] : (body() as unknown[]);
				db[collection] = (db[collection] ?? []).filter((row) => !keys.some((k) => loose(row[pkOf(collection)], k)));
				return new Response(null, { status: 204 });
			}
		}

		return notFound();
	}

	/* ---------------------------------------------------------------- 015 helpers */

	/** Directus UsersService.inviteUser: one invited user per new email; known emails are RECORD_NOT_UNIQUE. */
	function inviteUsers(body: { email: string | string[]; role: string }): Response | null {
		const emails = Array.isArray(body.email) ? body.email : [body.email];
		const known = emails.filter((email) => db['directus_users']!.some((u) => u['email'] === email));

		for (const email of emails.filter((email) => !known.includes(email)))
			create('directus_users', { email, role: body.role, status: 'invited' });

		if (known.length === 0) return null;

		return json(
			{
				errors: known.map((email) => ({
					message: `Value for field "email" in collection "directus_users" has to be unique.`,
					extensions: { code: 'RECORD_NOT_UNIQUE', collection: 'directus_users', field: 'email', invalid: email },
				})),
			},
			400,
		);
	}

	/* ---------------------------------------------------------------- 014 helpers */

	const isSingleton = (collection: string) =>
		snapshot.collections.some((c) => c['collection'] === collection && c['meta']?.singleton === true);

	function singleton(collection: string, url: URL): unknown {
		const row = rowsOf(collection)[0];
		return row ? project(collection, row, fieldList(url)) : null;
	}

	let serial = 1000;

	function create(collection: string, data: Row): Row {
		readable(collection);
		const pk = pkOf(collection);
		const intKey =
			fieldsOf(collection).find((f) => f.field === pk)?.type === 'integer' || collection === 'directus_presets';
		const row = { ...data, [pk]: data?.[pk] ?? (intKey ? ++serial : `bo-new-${++serial}`) };
		(db[collection] ??= []).push(row);
		return row;
	}

	function update(collection: string, key: unknown, data: Row): Row {
		const row = find(collection, key);
		if (!row) throw forbidden();
		Object.assign(row, data);
		return row;
	}

	function itemPermissions(collection: string): Row {
		const access = (action: string) =>
			isAdmin || (permissions[collection]?.[action] && permissions[collection][action].access !== 'none');
		return {
			update: { access: !!access('update') },
			delete: { access: !!access('delete') },
			share: { access: !!access('share') },
		};
	}

	const versionOf = (id: string) => {
		const version = find('directus_versions', decodeURIComponent(id));
		if (!version) throw forbidden();
		return version;
	};

	function compareVersion(id: string): Row {
		const version = versionOf(id);
		const main = find(version['collection'], version['item']) ?? {};
		const delta = Object.fromEntries(Object.entries(version['delta'] ?? {}).filter(([k]) => !k.startsWith('_')));
		return { outdated: false, mainHash: 'bo-hash', current: { ...main, ...delta }, main };
	}

	function saveVersion(id: string, edits: Row): Row {
		const version = versionOf(id);
		version['delta'] = { ...(version['delta'] ?? {}), ...edits };
		return { ...(find(version['collection'], version['item']) ?? {}), ...version['delta'] };
	}

	function promoteVersion(id: string, data: { mainHash?: string; fields?: string[] } | null): unknown {
		const version = versionOf(id);
		const delta = Object.entries(version['delta'] ?? {}).filter(
			([k]) => !k.startsWith('_') && (!data?.fields || data.fields.includes(k)),
		);
		update(version['collection'], version['item'], Object.fromEntries(delta));
		return version['item'];
	}

	function sortItems(collection: string, data: { item: unknown; to: unknown }): null {
		const sortField = snapshot.collections.find((c) => c['collection'] === collection)?.['meta']?.sort_field ?? 'sort';
		const rows = [...rowsOf(collection)].sort((a, b) => (a[sortField] ?? 0) - (b[sortField] ?? 0));
		const pk = pkOf(collection);
		const from = rows.findIndex((r) => loose(r[pk], data.item));
		const to = rows.findIndex((r) => loose(r[pk], data.to));
		const [moved] = rows.splice(from, 1);
		rows.splice(to, 0, moved!);
		rows.forEach((row, index) => (row[sortField] = index + 1));
		return null;
	}

	function exported(collection: string, url: URL): Response {
		const rows = list(collection, url) as Row[];
		const fields = fieldList(url).filter((f) => f !== '*');
		const keys = fields.length > 0 ? fields : Object.keys(rows[0] ?? {});
		const csv = [
			keys.map((k) => JSON.stringify(k)).join(','),
			...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
		].join('\n');
		return new Response(csv, { headers: { 'Content-Type': 'text/csv' } });
	}

	function graphqlById(query: string): Row {
		const match = /(\w+)_by_id\s*\(id:\s*"?([^")\s]+)"?\)/.exec(query);
		if (!match) throw new ApiError(400, 'INVALID_QUERY', 'mockFixtureApi: unsupported GraphQL query');
		const [, alias, key] = match as unknown as [string, string, string];
		const collection = rowsOf(alias).length > 0 || db[alias] ? alias : `directus_${alias}`;
		const row = find(collection, key);
		return { item: row ? { ...row } : null };
	}

	const fetch = stubFetch(async (url, init) => {
		const answer = answers[`${init.method ?? 'GET'} ${url.pathname}`];

		if (answer !== undefined) {
			if (typeof answer === 'function') return answer({ url, init });
			return json({ data: answer });
		}

		try {
			const result = await route(url, init);
			return result instanceof Response ? result : json({ data: result });
		} catch (error) {
			if (!(error instanceof ApiError)) throw error;
			return json({ errors: [{ message: error.message, extensions: { code: error.code } }] }, error.status);
		}
	});

	return Object.assign(fetch, { db });
}

/* ------------------------------------------------------------------------------------------------ query helpers */

/** `name` as JSON (`filter={...}`, the SDK form) or bracket notation (`filter[a][_eq]=1`); undefined when absent. */
function param(url: URL, name: string): unknown {
	const raw = url.searchParams.get(name);

	if (raw !== null) {
		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
	}

	let found = false;
	const out: Record<string, any> = {};

	for (const [key, value] of url.searchParams) {
		if (!key.startsWith(`${name}[`)) continue;
		found = true;
		const path = [...key.slice(name.length).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]!);
		let node = out;
		path.forEach((part, index) => {
			if (index === path.length - 1) node[part] = value;
			else node = node[part] ??= {};
		});
	}

	return found ? out : undefined;
}

function fieldList(url: URL): string[] {
	const fields = url.searchParams.getAll('fields[]');
	if (fields.length > 0) return fields;
	return (url.searchParams.get('fields') ?? '*').split(',').map((f) => f.trim());
}

function loose(a: unknown, b: unknown): boolean {
	if (a == null || b == null) return a == null && b == null;
	return a === b || String(a) === String(b);
}

const toList = (value: unknown): unknown[] => (Array.isArray(value) ? value : String(value).split(','));
const isTrue = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';

function order(a: unknown, b: unknown): number {
	const [x, y] = [Number(a), Number(b)];
	if (a !== '' && b !== '' && !Number.isNaN(x) && !Number.isNaN(y)) return x - y;
	return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function compare(op: string, value: unknown, arg: unknown): boolean {
	const text = String(value ?? '');

	switch (op) {
		case '_eq':
			return loose(value, arg);
		case '_neq':
			return !loose(value, arg);
		case '_in':
			return toList(arg).some((a) => loose(value, a));
		case '_nin':
			return !toList(arg).some((a) => loose(value, a));
		case '_null':
			return isTrue(arg) ? value == null : value != null;
		case '_nnull':
			return isTrue(arg) ? value != null : value == null;
		case '_empty':
			return value == null || value === '' || (Array.isArray(value) && value.length === 0);
		case '_nempty':
			return !(value == null || value === '' || (Array.isArray(value) && value.length === 0));
		case '_contains':
			return value != null && text.includes(String(arg));
		case '_ncontains':
			return value == null || !text.includes(String(arg));
		case '_icontains':
			return value != null && text.toLowerCase().includes(String(arg).toLowerCase());
		case '_starts_with':
			return value != null && text.startsWith(String(arg));
		case '_ends_with':
			return value != null && text.endsWith(String(arg));
		case '_gt':
			return value != null && order(value, arg) > 0;
		case '_gte':
			return value != null && order(value, arg) >= 0;
		case '_lt':
			return value != null && order(value, arg) < 0;
		case '_lte':
			return value != null && order(value, arg) <= 0;
		// Feature 014 (map layout): the bounding boxes of the GeoJSON value and of the filter geometry overlap.
		case '_intersects_bbox':
		case '_nintersects_bbox': {
			const a = bbox(value);
			const b = bbox(typeof arg === 'string' ? JSON.parse(arg) : arg);
			const hit = !!a && !!b && a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
			return op === '_intersects_bbox' ? hit : value != null && !hit;
		}
		// Feature 014 (calendar layout): `_between: [from, to]`, both ends included like Postgres BETWEEN.
		case '_between':
		case '_nbetween': {
			const [from, to] = (Array.isArray(arg) ? arg : String(arg).split(',')) as unknown[];
			const inside = value != null && order(value, from) >= 0 && order(value, to) <= 0;
			return op === '_between' ? inside : value != null && !inside;
		}
		default:
			throw new Error(`mockFixtureApi: unsupported filter operator ${op}`);
	}
}

/** [minX, minY, maxX, maxY] of a GeoJSON geometry, or null. */
function bbox(geometry: unknown): [number, number, number, number] | null {
	const points: number[][] = [];
	const walk = (node: unknown): void => {
		if (Array.isArray(node) && typeof node[0] === 'number') points.push(node as number[]);
		else if (Array.isArray(node)) node.forEach(walk);
	};
	walk((geometry as { coordinates?: unknown } | null)?.coordinates);
	if (points.length === 0) return null;
	const xs = points.map((p) => p[0]!);
	const ys = points.map((p) => p[1]!);
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Postgres order: ascending puts nulls last, descending first. */
function sorter(keys: string[]) {
	return (a: Row, b: Row) => {
		for (const key of keys) {
			const desc = key.startsWith('-');
			const field = desc ? key.slice(1) : key;
			const [x, y] = [a[field], b[field]];
			if (x == null && y == null) continue;
			const result = x == null ? 1 : y == null ? -1 : order(x, y);
			if (result !== 0) return desc ? -result : result;
		}

		return 0;
	};
}

/** Directus on Postgres answers counts as strings: `[{ count: "5" }]`, `[{ countDistinct: { id: "5" } }]`. */
function aggregated(rows: Row[], aggregate: Record<string, unknown>): Row {
	return Object.fromEntries(
		Object.entries(aggregate).map(([fn, value]) => {
			if (fn !== 'count' && fn !== 'countDistinct') throw new Error(`mockFixtureApi: unsupported aggregate ${fn}`);
			const fields = toList(value).map(String);
			if (fn === 'count' && fields.length === 1 && fields[0] === '*') return [fn, String(rows.length)];

			return [
				fn,
				Object.fromEntries(
					fields.map((field) => {
						const values = rows.map((r) => r[field]).filter((v) => v != null);
						return [field, String(fn === 'count' ? values.length : new Set(values.map(String)).size)];
					}),
				),
			];
		}),
	);
}
