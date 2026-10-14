// Exports the fixture set seeded by seed.mjs into a normalized snapshot (data-model §6): bo_* collections, fields,
// relations, items, the bo-fixtures files, the bo-flow flow and /permissions/me of admin, bo-editor and bo-viewer.
// Normalization: every uuid becomes `bo-<n>` (numbered in seed creation order, then in order of appearance), times,
// user stamps, `filename_disk`, `meta.id` and permission ids become null, argon2 hashes a fixed string.
// Usage: node export.mjs --api <url> (--token <admin token> | --email <e> --password <p>) [--out <dir>] [--kind directus]
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Api, FIXED_UUIDS, FLOW, FOLDER, USERS, query, readArgs } from './lib.mjs';

const args = readArgs();
const api = await Api.connect(args);
const out = args.out ?? join(dirname(fileURLToPath(import.meta.url)), 'snapshot');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NULLED = new Set([
	'date_created',
	'date_updated',
	'user_created',
	'user_updated',
	'modified_on',
	'uploaded_on',
	'created_on',
	'filename_disk',
	'last_access',
	'last_page',
]);
const HASH = '$argon2id$v=19$m=65536,t=3,p=4$bo-normalized';

const ids = new Map();

function stableId(uuid) {
	const key = uuid.toLowerCase();
	if (!ids.has(key)) ids.set(key, `bo-${ids.size + 1}`);
	return ids.get(key);
}

function normalize(value, key) {
	if (key !== undefined && NULLED.has(key)) return null;
	if (Array.isArray(value)) return value.map((v) => normalize(v));

	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, k)]));
	}

	if (typeof value === 'string') {
		if (value.startsWith('$argon2')) return HASH;
		return value.replace(UUID, (uuid) => (FIXED_UUIDS.includes(uuid) ? uuid : stableId(uuid)));
	}

	return value;
}

const bo = (name) => name.startsWith('bo_');
const by =
	(...keys) =>
	(a, b) => {
		for (const key of keys) {
			const [x, y] = [key(a), key(b)];
			if (x < y) return -1;
			if (x > y) return 1;
		}

		return 0;
	};

/* ---------------------------------------------------------------- read */

const folder = (await api.get(`/folders${query({ filter: { name: { _eq: FOLDER } }, fields: 'id' })}`))[0]?.id;
if (!folder) throw new Error(`Folder ${FOLDER} not found: run seed.mjs first`);

const files = await api.get(`/files${query({ filter: { folder: { _eq: folder } }, sort: 'title', limit: -1 })}`);
const flows = await api.get(
	`/flows${query({
		filter: { name: { _eq: FLOW } },
		fields: 'id,name,icon,color,status,trigger,options,accountability,operation',
	})}`,
);

const admin = await api.get('/users/me?fields=id');
const users = await api.get(
	`/users${query({ filter: { email: { _in: Object.values(USERS).map((u) => u.email) } }, fields: 'id,email,role,policies', sort: 'email' })}`,
);
const policies = await api.get(
	`/policies${query({ filter: { name: { _in: Object.keys(USERS) } }, fields: 'id,name', sort: 'name' })}`,
);
const roles = await api.get(
	`/roles${query({ filter: { name: { _in: Object.keys(USERS) } }, fields: 'id,name', sort: 'name' })}`,
);

// System collections the bo_* fields point at: the mocked API serves their configuration next to the bo_* one.
const SYSTEM = ['directus_files', 'directus_folders', 'directus_users'];
const allCollections = (await api.get('/collections')).sort(by((c) => c.collection));
const collections = allCollections.filter((c) => bo(c.collection));
const systemCollections = allCollections.filter((c) => SYSTEM.includes(c.collection));
const allFields = (await api.get('/fields'))
	.map((f) => ({ ...f, meta: f.meta && { ...f.meta, id: null } }))
	.sort(
		by(
			(f) => f.collection,
			(f) => f.meta?.sort ?? 0,
			(f) => f.field,
		),
	);
const fields = allFields.filter((f) => bo(f.collection));
const systemFields = allFields.filter((f) => SYSTEM.includes(f.collection));
const relations = (await api.get('/relations'))
	.filter((r) => bo(r.collection) || bo(r.related_collection ?? ''))
	.map((r) => ({ ...r, meta: r.meta && { ...r.meta, id: null } }))
	.sort(
		by(
			(r) => r.collection,
			(r) => r.field,
		),
	);

// Alias keys of an item come back in no fixed order: order every row (and related rows) by fields.json.
const fieldOrder = Map.groupBy(fields, (f) => f.collection);

const relatedCollection = (collection, field) =>
	relations.find((r) => r.collection === collection && r.field === field)?.related_collection ??
	relations.find((r) => r.related_collection === collection && r.meta?.one_field === field)?.collection;

function ordered(collection, row) {
	if (Array.isArray(row)) return row.map((r) => ordered(collection, r));
	if (!row || typeof row !== 'object' || !fieldOrder.has(collection)) return row;
	const names = fieldOrder.get(collection).map((f) => f.field);

	return Object.fromEntries(
		Object.keys(row)
			.sort((a, b) => names.indexOf(a) - names.indexOf(b))
			.map((key) => [key, ordered(relatedCollection(collection, key), row[key])]),
	);
}

const items = {};

for (const { collection, meta } of collections) {
	const pk = fields.find((f) => f.collection === collection && f.schema?.is_primary_key)?.field;
	// uuid keys are random: sort those rows by their display field instead.
	const sort = collection === 'bo_m2a_b' ? 'title' : pk;
	const rows = await api.get(`/items/${collection}${query({ fields: '*.*', sort, limit: -1 })}`);
	items[collection] = ordered(collection, rows);
	if (meta?.singleton) throw new Error(`Unexpected singleton ${collection}`);
}

// Only bo_* and system collections: the database is shared with other suites that add their own collections.
const keepPermissions = (permissions) =>
	Object.fromEntries(
		Object.entries(permissions ?? {})
			.filter(([collection]) => bo(collection) || collection.startsWith('directus_'))
			.sort(([a], [b]) => (a < b ? -1 : 1)),
	);

// What hydrate reads for each user (/users/me as the 012 user store asks, /policies/me/globals, /permissions/me).
const permissions = {};
const accounts = {};

for (const [name, client] of [
	['admin', api],
	...(await Promise.all(
		Object.entries(USERS).map(async ([n, u]) => [n, await new Api(api.url).login(u.email, u.password)]),
	)),
]) {
	permissions[name] = keepPermissions(await client.get('/permissions/me'));
	accounts[name] = {
		me: await client.get('/users/me?fields=*,role.id,role.name'),
		globals: await client.get('/policies/me/globals'),
	};
}

const info = await api.get('/server/info');

/* ---------------------------------------------------------------- normalize and write */

// Seed creation order first, so the numbers do not depend on what the API returns first.
for (const uuid of [
	admin.id,
	folder,
	...files.map((f) => f.id),
	...flows.map((f) => f.id),
	...Object.keys(USERS).flatMap((name) => [
		policies.find((p) => p.name === name)?.id,
		roles.find((r) => r.name === name)?.id,
		users.find((u) => u.email === USERS[name].email)?.id,
	]),
	...items.bo_m2a_b.map((i) => i.id),
]) {
	if (uuid) stableId(uuid);
}

const snapshot = {
	'meta.json': {
		api: args.kind ?? 'directus',
		version: info.version,
		date: new Date().toISOString().slice(0, 10),
		geometry: fields.some((f) => f.type.startsWith('geometry')),
	},
	'collections.json': collections,
	'collections.system.json': systemCollections,
	'fields.json': fields,
	'fields.system.json': systemFields,
	'users.json': accounts,
	'relations.json': relations,
	'files.json': files,
	'flows.json': flows,
	...Object.fromEntries(Object.entries(items).map(([collection, rows]) => [`items.${collection}.json`, rows])),
	...Object.fromEntries(Object.entries(permissions).map(([name, value]) => [`permissions.${name}.json`, value])),
};

mkdirSync(out, { recursive: true });

// Rewrite the generated files only; hand-written expected.*.json stay.
for (const file of readdirSync(out)) {
	if (!file.startsWith('expected.') && file.endsWith('.json')) rmSync(join(out, file));
}

for (const [file, value] of Object.entries(snapshot)) {
	writeFileSync(join(out, file), `${JSON.stringify(normalize(value), null, '\t')}\n`);
}

process.stdout.write(`Exported ${Object.keys(snapshot).length} files to ${out}\n`);
