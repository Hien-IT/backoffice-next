// Exports the fixture set seeded by seed.mjs into a normalized snapshot (data-model §6): bo_* collections, fields,
// relations, items, the bo-fixtures files, the bo-flow flow and /permissions/me of admin, bo-editor and bo-viewer.
// Feature 015 adds the bo-files folder tree and its files, the roles and the directory users (last in the snapshot, so
// the 013 and 014 uuids keep their numbers). Feature 016 adds the Settings role, policy, permissions, access and
// translation, after 015.
// Normalization: every uuid becomes `bo-<n>` (numbered in seed creation order, then in order of appearance), times,
// user stamps, `filename_disk`, `meta.id` and permission ids become null, argon2 hashes a fixed string.
// Usage: node export.mjs --api <url> (--token <admin token> | --email <e> --password <p>) [--out <dir>] [--kind directus]
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	Api,
	CONTENT_FLOWS,
	DIRECTORY_USERS,
	FILES_FOLDERS,
	FIXED_UUIDS,
	FLOW,
	FLOWS,
	FOLDER,
	query,
	readArgs,
	SETTINGS,
	SHARE,
	SUB_ROLE,
	USERS,
} from './lib.mjs';

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
	// Version deltas carry the save time (014).
	'_date',
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
		filter: { name: { _in: [FLOW, ...CONTENT_FLOWS] } },
		fields: 'id,name,icon,color,status,trigger,options,accountability,operation',
		sort: 'name',
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
// Feature 016: the fields of directus_collections too (the form of the Settings collection page), not its row.
const systemFields = allFields.filter((f) => [...SYSTEM, 'directus_collections'].includes(f.collection));
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

for (const { collection, meta, schema } of collections) {
	// A folder (014 `bo_folder`) has no table.
	if (!schema) continue;
	const pk = fields.find((f) => f.collection === collection && f.schema?.is_primary_key)?.field;
	// uuid keys are random: sort those rows by their display field instead.
	const sort = collection === 'bo_m2a_b' ? 'title' : pk;
	// A singleton answers with one object (014 `bo_singleton`): kept as a one-row list like the other collections.
	const rows = meta?.singleton
		? [await api.get(`/items/${collection}${query({ fields: '*.*' })}`)]
		: await api.get(`/items/${collection}${query({ fields: '*.*', sort, limit: -1 })}`);
	items[collection] = ordered(collection, rows);
}

/* Content module rows (014). Serial ids depend on what else the shared database holds: presets and revisions get
   their position instead; uuid ids are numbered after the 013 ones (below). */
const onBo = { collection: { _starts_with: 'bo_' } };
const presets = (await api.get(`/presets${query({ filter: onBo, sort: 'id', limit: -1 })}`)).map((preset, index) => ({
	...preset,
	id: index + 1,
}));
const versions = await api.get(
	`/versions${query({ filter: onBo, fields: 'id,key,name,collection,item,hash,delta', sort: 'key', limit: -1 })}`,
);
const shares = await api.get(
	`/shares${query({ filter: { name: { _eq: SHARE.name } }, fields: 'id,name,collection,item,role,password,date_start,date_end,max_uses,times_used' })}`,
);
const comments = await api.get(
	`/comments${query({ filter: onBo, fields: 'id,collection,item,comment', sort: 'comment' })}`,
);
const revisions = (
	await api.get(
		`/revisions${query({
			filter: { collection: { _eq: 'bo_content' }, item: { _eq: '1' } },
			fields: 'id,collection,item,data,delta,version,activity.action',
			sort: 'id',
			limit: -1,
		})}`,
	)
).map((revision, index) => ({ ...revision, id: index + 1 }));

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

/* Files and Users modules (015). */
const directoryFolders = await api.get(
	`/folders${query({ filter: { name: { _in: Object.values(FILES_FOLDERS) } }, fields: 'id,name,parent', sort: 'name' })}`,
);
const directoryFiles = await api.get(
	`/files${query({ filter: { folder: { _in: directoryFolders.map((f) => f.id) } }, sort: 'title', limit: -1 })}`,
);
const directoryRoles = await api.get(
	`/roles${query({ filter: { name: { _in: [...Object.keys(USERS), SUB_ROLE] } }, fields: 'id,name,icon,parent', sort: 'name' })}`,
);
const directoryUsers = await api.get(
	`/users${query({
		filter: { email: { _in: Object.values(DIRECTORY_USERS).map((u) => u.email) } },
		fields:
			'id,email,first_name,last_name,status,role,provider,external_identifier,title,location,token,tfa_secret,avatar',
		sort: 'email',
	})}`,
);

/* Settings module (016). */
const settingsRoles = await api.get(
	`/roles${query({ filter: { name: { _eq: SETTINGS.role } }, fields: 'id,name,icon,description,parent' })}`,
);
const settingsPolicies = await api.get(
	`/policies${query({
		filter: { name: { _eq: SETTINGS.policy } },
		fields: 'id,name,icon,description,ip_access,enforce_tfa,admin_access,app_access',
	})}`,
);
const settingsPermissions = await api.get(
	`/permissions${query({
		filter: { policy: { _in: settingsPolicies.map((p) => p.id) } },
		fields: 'policy,collection,action,permissions,validation,presets,fields',
		sort: 'action',
		limit: -1,
	})}`,
);
const settingsAccess = await api.get(
	`/access${query({ filter: { policy: { _in: settingsPolicies.map((p) => p.id) } }, fields: 'role,user,policy,sort' })}`,
);
// Feature 017: the flows of the editor set, their operations (ids become keys through the stable ids) and the steps of
// the three runs of bo_all_ops (statuses only: the payloads hold times and tokens).
const editorFlows = await api.get(
	`/flows${query({
		filter: { name: { _in: Object.values(FLOWS) } },
		fields: 'id,name,icon,color,description,status,trigger,options,accountability,operation',
		sort: 'name',
	})}`,
);
const editorOperations = (
	await api.get(
		`/operations${query({
			filter: { flow: { _in: editorFlows.map((f) => f.id) } },
			fields: 'id,flow,name,key,type,position_x,position_y,options,resolve,reject',
			limit: -1,
		})}`,
	)
).sort((a, b) => {
	const flowName = (o) => editorFlows.find((f) => f.id === o.flow).name;
	return flowName(a).localeCompare(flowName(b)) || a.key.localeCompare(b.key);
});
const allOps = editorFlows.find((f) => f.name === FLOWS.all);
const flowRuns = (
	await api.get(
		`/revisions${query({
			filter: { collection: { _eq: 'directus_flows' }, item: { _eq: allOps.id }, activity: { action: { _eq: 'run' } } },
			fields: 'data',
			sort: 'id',
		})}`,
	)
).map((revision) => ({
	reason: revision.data.data.$trigger.body.reason,
	steps: revision.data.steps.map(({ operation, key, status }) => ({ operation, key, status })),
}));

const settingsTranslations = await api.get(
	`/translations${query({ filter: { key: { _eq: SETTINGS.translationKey } }, fields: 'key,language,value', sort: 'language' })}`,
);

/* ---------------------------------------------------------------- normalize and write */

// Seed creation order first, so the numbers do not depend on what the API returns first.
for (const uuid of [
	admin.id,
	folder,
	...files.map((f) => f.id),
	...flows.filter((f) => f.name === FLOW).map((f) => f.id),
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
	// 014 last: their new uuids are numbered after every 013 one, so the 013 files keep their numbers.
	'presets.json': presets,
	'versions.json': versions.map((v) => ({ ...v, hash: v.hash ? 'bo-hash' : null })),
	'shares.json': shares,
	'comments.json': comments,
	'revisions.bo_content.json': revisions,
	// 015 last, after 014.
	'folders.json': directoryFolders,
	'files.directory.json': directoryFiles,
	'roles.json': directoryRoles,
	'users.directory.json': directoryUsers,
	// 016 last, after 015.
	'settings.roles.json': settingsRoles,
	'settings.policies.json': settingsPolicies,
	'settings.permissions.json': settingsPermissions,
	'settings.access.json': settingsAccess,
	'settings.translations.json': settingsTranslations,
	// 017 last, after 016.
	'flows.editor.json': editorFlows,
	'operations.json': editorOperations,
	'flows.runs.json': flowRuns,
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
