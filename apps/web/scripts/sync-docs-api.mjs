// Backoffice (spec 033, FR-021..FR-029, research R7): writes the API part of the documentation area,
// apps/web/src/docs/api/generated/<resource>.json (one file per tag) and index.json. The sources are the static API
// description of libs/specs (dist/openapi.json, built when missing) and the documentation-only supplement
// apps/web/src/docs/api/supplement/*.yaml (the seven resources the static description lacks, the /backoffice/* routes,
// and the relation routes it describes wrongly). The supplement never reaches /server/specs/oas (FR-023).
// Usage: `pnpm --filter @backoffice/web sync-docs-api`, or `node scripts/sync-docs-api.mjs [outDir]`. The output is
// committed; scripts/sync-docs-api.test.ts runs the script again into a temporary folder and compares.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import slugify from '@sindresorhus/slugify';
import yaml from 'js-yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const SPEC = join(ROOT, 'libs/specs/dist/openapi.json');
export const SUPPLEMENT_DIR = join(ROOT, 'apps/web/src/docs/api/supplement');
export const OUT_DIR = join(ROOT, 'apps/web/src/docs/api/generated');

export const HOST = 'https://backoffice.example.com';

/**
 * Operations of the static description the API does not serve as described (measured on the API 2026-11-17, research
 * R7). They get no entry; the supplement describes the routes that replace them.
 */
export const EXCLUDED = {
	oauth: 'GET /auth/oauth answers 404: the providers are listed at GET /auth.',
	oauthProvider: 'GET /auth/oauth/{provider} answers 404: single sign-on starts at /auth/login/{provider}.',
	getRelation: 'A relation is addressed by collection and field, not by a numeric id (supplement relations.yaml).',
	updateRelation: 'A relation is addressed by collection and field, not by a numeric id (supplement relations.yaml).',
	deleteRelation: 'A relation is addressed by collection and field, not by a numeric id (supplement relations.yaml).',
	updateExtensionBundle: 'PATCH /extensions/{bundle}/{name} answers 404: an extension is updated by its id.',
};

const METHODS = ['get', 'post', 'patch', 'put', 'delete', 'head', 'search'];
const BRAND = /(?<![A-Za-z])Directus(?![A-Za-z])/g;

// ---------------------------------------------------------------------------------------------------------------
// GraphQL examples (FR-026). The first line names the endpoint; tests/parity/src/docs/graphql-examples.test.ts
// validates every example against the schema of the running API.

const gql = (scope, body) => `# POST ${scope === 'items' ? '/graphql' : '/graphql/system'}\n${body}`;

/** Sample `data` of the create and update mutations of the system collections (the required fields of the input). */
const SYSTEM_DATA = {
	activity: null,
	revisions: null,
	comments: {
		create: '{ collection: "articles", item: "1", comment: "Đã duyệt." }',
		update: '{ comment: "Đã duyệt bản sửa." }',
	},
	files: { create: '{ storage: "local", filename_download: "anh-bia.jpg" }', update: '{ title: "Ảnh bìa" }' },
	flows: { create: '{ name: "Gửi báo cáo" }', update: '{ status: "inactive" }' },
	folders: { create: '{ name: "Ảnh" }', update: '{ name: "Ảnh sản phẩm" }' },
	operations: { create: '{ key: "log", type: "log", position_x: 19, position_y: 1 }', update: '{ name: "Ghi log" }' },
	permissions: { create: '{ collection: "articles", action: "read" }', update: '{ fields: ["*"] }' },
	presets: { create: '{ bookmark: "Bài đã đăng", collection: "articles" }', update: '{ bookmark: "Bài nổi bật" }' },
	roles: { create: '{ name: "Biên tập viên" }', update: '{ icon: "edit" }' },
	users: { create: '{ email: "an@example.com" }', update: '{ first_name: "An" }' },
	versions: { create: '{ key: "draft", collection: "articles", item: "1" }', update: '{ name: "Bản nháp" }' },
	policies: {
		create: '{ name: "Biên tập", enforce_tfa: false, admin_access: false, app_access: true }',
		update: '{ description: "Sửa nội dung." }',
	},
	access: { create: '{ sort: 1 }', update: '{ sort: 2 }' },
	dashboards: { create: '{ name: "Doanh thu" }', update: '{ icon: "insights" }' },
	panels: {
		create: '{ type: "metric", show_header: true, position_x: 1, position_y: 1, width: 12, height: 6 }',
		update: '{ name: "Tổng đơn" }',
	},
	notifications: { create: '{ subject: "Báo cáo tháng đã xong" }', update: '{ status: "archived" }' },
	translations: { create: '{ language: "vi-VN", key: "greeting", value: "Xin chào" }', update: '{ value: "Chào" }' },
	shares: { create: '{ collection: "articles", item: "1" }', update: '{ name: "Bài cho đối tác" }' },
};

const ITEMS_DATA = { create: '{ title: "Bài đầu tiên" }', update: '{ title: "Bài đã sửa" }' };

/**
 * The standard read and write operations of a collection, from the method and the shape of the path: every route of
 * one item ends with `/{id}` (`/items/{collection}` is the list).
 */
function crudGraphql(method, path, scope, name, data) {
	const one = /\/\{id\}$/.test(path);
	const selection = '{\n    id\n  }';

	switch (`${method} ${one ? 'one' : 'many'}`) {
		case 'GET many':
			return gql(scope, `query {\n  ${name}(limit: 2) ${selection}\n}`);
		case 'GET one':
			return gql(scope, `query {\n  ${name}_by_id(id: "<id>") ${selection}\n}`);
		case 'POST many':
			return data ? gql(scope, `mutation {\n  create_${name}_item(data: ${data.create}) ${selection}\n}`) : false;
		case 'PATCH many':
			return data
				? gql(scope, `mutation {\n  update_${name}_items(ids: ["<id>"], data: ${data.update}) ${selection}\n}`)
				: false;
		case 'PATCH one':
			return data
				? gql(scope, `mutation {\n  update_${name}_item(id: "<id>", data: ${data.update}) ${selection}\n}`)
				: false;
		case 'DELETE many':
			return data ? gql(scope, `mutation {\n  delete_${name}_items(ids: ["<id>"]) {\n    ids\n  }\n}`) : false;
		case 'DELETE one':
			return data ? gql(scope, `mutation {\n  delete_${name}_item(id: "<id>") {\n    id\n  }\n}`) : false;
		default:
			return false;
	}
}

const sys = (body) => gql('system', body);

/** Operations outside the standard pattern: an example by hand, or false when GraphQL has no counterpart. */
export const GRAPHQL = {
	login: sys(
		'mutation {\n  auth_login(email: "admin@example.com", password: "<password>") {\n    access_token\n    refresh_token\n    expires\n  }\n}',
	),
	refresh: sys(
		'mutation {\n  auth_refresh(refresh_token: "<refresh-token>", mode: json) {\n    access_token\n    refresh_token\n    expires\n  }\n}',
	),
	logout: sys('mutation {\n  auth_logout(refresh_token: "<refresh-token>")\n}'),
	passwordRequest: sys('mutation {\n  auth_password_request(email: "an@example.com")\n}'),
	passwordReset: sys('mutation {\n  auth_password_reset(token: "<token>", password: "<password>")\n}'),
	ping: sys('query {\n  server_ping\n}'),
	serverInfo: sys('query {\n  server_info {\n    project {\n      project_name\n    }\n  }\n}'),
	getSettings: sys('query {\n  settings {\n    project_name\n  }\n}'),
	updateSetting: sys('mutation {\n  update_settings(data: { project_name: "Backoffice" }) {\n    project_name\n  }\n}'),
	getMe: sys('query {\n  users_me {\n    id\n    email\n  }\n}'),
	updateMe: sys('mutation {\n  update_users_me(data: { first_name: "An" }) {\n    id\n  }\n}'),
	invite: sys('mutation {\n  users_invite(email: "an@example.com", role: "<role-id>")\n}'),
	acceptInvite: sys('mutation {\n  users_invite_accept(token: "<token>", password: "<password>")\n}'),
	meTfaEnable: sys('mutation {\n  users_me_tfa_enable(otp: "123456", secret: "<secret>")\n}'),
	meTfaDisable: sys('mutation {\n  users_me_tfa_disable(otp: "123456")\n}'),
	updateLastUsedPageMe: false,
	getMyPermissions: sys('query {\n  permissions_me\n}'),
	getMyPolicyGlobals: sys(
		'query {\n  policies_me_globals {\n    app_access\n    admin_access\n    enforce_tfa\n  }\n}',
	),
	getCollections: sys('query {\n  collections {\n    collection\n  }\n}'),
	getCollection: sys('query {\n  collections_by_name(name: "articles") {\n    collection\n  }\n}'),
	// The GraphQL input of a new collection has no name field: a collection is created over REST.
	createCollection: false,
	updateCollection: sys(
		'mutation {\n  update_collections_item(collection: "articles", data: { meta: { note: "Bài viết" } }) {\n    collection\n  }\n}',
	),
	deleteCollection: sys('mutation {\n  delete_collections_item(collection: "articles") {\n    collection\n  }\n}'),
	getFields: sys('query {\n  fields {\n    collection\n    field\n  }\n}'),
	getCollectionFields: sys('query {\n  fields_in_collection(collection: "articles") {\n    field\n  }\n}'),
	getCollectionField: sys(
		'query {\n  fields_by_name(collection: "articles", field: "title") {\n    field\n    type\n  }\n}',
	),
	createField: sys(
		'mutation {\n  create_fields_item(collection: "articles", data: { field: "title", type: "string" }) {\n    field\n  }\n}',
	),
	updateField: sys(
		'mutation {\n  update_fields_item(collection: "articles", field: "title", data: { meta: { note: "Tiêu đề" } }) {\n    field\n  }\n}',
	),
	deleteField: sys(
		'mutation {\n  delete_fields_item(collection: "articles", field: "title") {\n    collection\n    field\n  }\n}',
	),
	getRelations: sys('query {\n  relations {\n    collection\n    field\n    related_collection\n  }\n}'),
	createRelation: sys(
		'mutation {\n  create_relations_item(data: { collection: "articles", field: "author", related_collection: "directus_users" }) {\n    collection\n    field\n  }\n}',
	),
	getRelationsInCollection: sys(
		'query {\n  relations_in_collection(collection: "articles") {\n    field\n    related_collection\n  }\n}',
	),
	getRelationByField: sys(
		'query {\n  relations_by_name(collection: "articles", field: "author") {\n    related_collection\n  }\n}',
	),
	updateRelationByField: sys(
		'mutation {\n  update_relations_item(collection: "articles", field: "author", data: { meta: { sort_field: "sort" } }) {\n    field\n  }\n}',
	),
	deleteRelationByField: sys(
		'mutation {\n  delete_relations_item(collection: "articles", field: "author") {\n    collection\n    field\n  }\n}',
	),
	listExtensions: sys('query {\n  extensions {\n    name\n    meta {\n      enabled\n    }\n  }\n}'),
	updateExtensions: sys(
		'mutation {\n  update_extensions_item(id: "<id>", data: { meta: { enabled: false } }) {\n    name\n  }\n}',
	),
	random: sys('mutation {\n  utils_random_string(length: 32)\n}'),
	'hash-generate': sys('mutation {\n  utils_hash_generate(string: "<text>")\n}'),
	'hash-verify': sys('mutation {\n  utils_hash_verify(string: "<text>", hash: "<hash>")\n}'),
	sort: sys('mutation {\n  utils_sort(collection: "articles", item: 1, to: 5)\n}'),
	'clear-cache': sys('mutation {\n  utils_cache_clear\n}'),
	export: false,
	import: false,
	schemaSnapshot: false,
	schemaDiff: false,
	schemaApply: false,
	getAsset: false,
	compareContentVersion: false,
	saveContentVersion: false,
	promoteContentVersion: false,
	authenticateShare: false,
	inviteShare: false,
	getShareInfo: false,
};

/** The GraphQL example of an operation: the table, the standard pattern of its collection, or false. */
function graphqlExample(operationId, method, path, tag) {
	if (operationId in GRAPHQL) return GRAPHQL[operationId];
	if (path.startsWith('/backoffice/')) return false;
	if (path.startsWith('/items/')) return crudGraphql(method, path, 'items', 'articles', ITEMS_DATA);

	const collection = tag?.['x-collection'];
	if (!collection) return false;

	const name = collection.replace(/^directus_/, '');
	if (!(name in SYSTEM_DATA)) return false;

	return crudGraphql(method, path, 'system', name, SYSTEM_DATA[name]);
}

// ---------------------------------------------------------------------------------------------------------------
// Sources

/** The bundled static description; built first when the package was not built yet (dist/ is not in git). */
export function loadSpec(path = SPEC) {
	if (!existsSync(path)) {
		const run = spawnSync('pnpm', ['--filter', '@backoffice/specs', 'build'], { cwd: ROOT, stdio: 'inherit' });
		if (run.status !== 0 || !existsSync(path)) throw new Error(`sync-docs-api: could not build ${path}`);
	}

	return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadSupplements(dir = SUPPLEMENT_DIR) {
	return readdirSync(dir)
		.filter((file) => file.endsWith('.yaml'))
		.sort()
		.map((file) => ({ file, doc: yaml.load(readFileSync(join(dir, file), 'utf8')) ?? {} }));
}

/** The seven standard operations of a collection, from `x-crud` of a supplement tag. */
function expandCrud(tag) {
	const crud = tag['x-crud'];
	const { path, id, noun, schema } = crud;
	const ref = { $ref: `#/components/schemas/${schema}` };
	const one = { $ref: '#/components/parameters/Id' };
	const list = ['Fields', 'Limit', 'Offset', 'Sort', 'Filter', 'Search', 'Meta'].map((p) => ({
		$ref: `#/components/parameters/${p}`,
	}));
	const single = ['Fields', 'Meta'].map((p) => ({ $ref: `#/components/parameters/${p}` }));
	const unauthorized = { $ref: '#/components/responses/UnauthorizedError' };
	const data = (schemaOf) => ({
		description: 'Thành công',
		content: { 'application/json': { schema: { type: 'object', properties: { data: schemaOf } } } },
	});
	const keys = {
		description: 'Khóa của các mục cần sửa hoặc xóa.',
		required: true,
		content: { 'application/json': { schema: { type: 'array', items: { type: 'string' }, example: ['<id>'] } } },
	};
	const base = { tags: [tag.name], ...(crud.access ? { 'x-access': crud.access } : {}) };

	return {
		[path]: {
			get: {
				...base,
				operationId: `get${id.plural}`,
				summary: `Liệt kê ${noun}`,
				description: `Các ${noun} mà người gọi được đọc.`,
				parameters: list,
				responses: { 200: data({ type: 'array', items: ref }), 401: unauthorized },
			},
			post: {
				...base,
				operationId: `create${id.singular}`,
				summary: `Tạo ${noun}`,
				description: `Tạo một ${noun}, hoặc nhiều khi thân request là một mảng.`,
				parameters: single,
				requestBody: { required: true, content: { 'application/json': { schema: ref } } },
				responses: { 200: data(ref), 401: unauthorized },
			},
			patch: {
				...base,
				operationId: `update${id.plural}`,
				summary: `Sửa nhiều ${noun}`,
				description: `Sửa nhiều ${noun} một lúc: \`keys\` là khóa của các mục, \`data\` là giá trị mới.`,
				parameters: single,
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { keys: { type: 'array', items: { type: 'string' }, example: ['<id>'] }, data: ref },
							},
						},
					},
				},
				responses: { 200: data({ type: 'array', items: ref }), 401: unauthorized },
			},
			delete: {
				...base,
				operationId: `delete${id.plural}`,
				summary: `Xóa nhiều ${noun}`,
				description: `Xóa nhiều ${noun} một lúc.`,
				requestBody: keys,
				responses: { 204: { description: 'Thành công' }, 401: unauthorized },
			},
		},
		[`${path}/{id}`]: {
			get: {
				...base,
				operationId: `get${id.singular}`,
				summary: `Lấy một ${noun}`,
				description: `Một ${noun} theo khóa.`,
				parameters: [one, ...single],
				responses: { 200: data(ref), 401: unauthorized, 404: { $ref: '#/components/responses/NotFoundError' } },
			},
			patch: {
				...base,
				operationId: `update${id.singular}`,
				summary: `Sửa một ${noun}`,
				description: `Sửa một ${noun}; chỉ các field gửi lên bị đổi.`,
				parameters: [one, ...single],
				requestBody: { required: true, content: { 'application/json': { schema: ref } } },
				responses: { 200: data(ref), 401: unauthorized },
			},
			delete: {
				...base,
				operationId: `delete${id.singular}`,
				summary: `Xóa một ${noun}`,
				description: `Xóa một ${noun}.`,
				parameters: [one],
				responses: { 204: { description: 'Thành công' }, 401: unauthorized },
			},
		},
	};
}

// ---------------------------------------------------------------------------------------------------------------
// Build

const slug = (text) => slugify(text) || 'section';
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/**
 * The example of a schema: its `example`, else one built from its properties. References are followed two levels deep
 * (an item and the objects it names); deeper ones are null.
 */
function buildExample(schema, resolveSchema, refs = 0) {
	if (!schema) return null;
	if (schema.$ref) return refs >= 2 ? null : buildExample(resolveSchema(schema.$ref), resolveSchema, refs + 1);
	if ('example' in schema) return clone(schema.example);
	if (schema.oneOf || schema.anyOf) return buildExample((schema.oneOf ?? schema.anyOf)[0], resolveSchema, refs);
	if (schema.properties) {
		return Object.fromEntries(
			Object.entries(schema.properties).map(([key, value]) => [key, buildExample(value, resolveSchema, refs)]),
		);
	}
	if (schema.type === 'array') {
		const item = buildExample(schema.items, resolveSchema, refs);
		return item === null ? [] : [item];
	}
	return { string: '', integer: 0, number: 0, boolean: false, object: {} }[schema.type] ?? null;
}

// Fields the server fills: never in the body of an example.
const SERVER_FIELDS = /^(id|date_created|date_updated|user_created|user_updated|uploaded_by|uploaded_on|times_used)$/;

/** The body of a REST example: the properties that have an example, or are required; an empty string is a placeholder. */
function bodyExample(schema, resolveSchema) {
	const target = schema?.$ref ? resolveSchema(schema.$ref) : schema;
	if (!target) return undefined;
	if ('example' in target) return clone(target.example);
	if (target.type === 'array') return [buildExample(target.items, resolveSchema, 1) || '<id>'];
	if (!target.properties) return {};

	const required = new Set(target.required ?? []);
	const entries = Object.entries(target.properties).filter(
		([key, value]) =>
			!SERVER_FIELDS.test(key) &&
			(required.has(key) || (value && !value.$ref && 'example' in value && value.example !== null)),
	);

	return Object.fromEntries(
		entries.slice(0, 6).map(([key, value]) => {
			const example = buildExample(value, resolveSchema, 1);
			return [key, example === '' ? `<${key}>` : example];
		}),
	);
}

function restExample(method, path, body, query, resolveSchema, access) {
	const url = `${HOST}${path.replace(/\{collection\}/g, 'articles').replace(/\{([^}]+)\}/g, '<$1>')}${
		method === 'GET' && query.some((param) => param.name === 'limit') ? '?limit=2' : ''
	}`;
	const lines = [`curl${method === 'GET' ? '' : ` -X ${method}`} "${url}"`];

	if (access !== 'public') lines.push('  -H "Authorization: Bearer <token>"');

	// The static description gives the item routes no body schema: the example uses the `title` of `articles`.
	const itemBody = path.startsWith('/items/')
		? {
				POST: { title: 'Bài đầu tiên' },
				PATCH: /\/\{id\}$/.test(path) ? { title: 'Bài đã sửa' } : { keys: ['<id>'], data: { title: 'Bài đã sửa' } },
				DELETE: /\/\{id\}$/.test(path) ? undefined : ['<id>'],
			}[method]
		: undefined;

	if (itemBody) {
		lines.push('  -H "Content-Type: application/json"', `  -d '${JSON.stringify(itemBody)}'`);
	} else if (body?.contentType === 'multipart/form-data') {
		lines.push('  -F "file=@anh-bia.jpg"');
	} else if (body) {
		const example = bodyExample(body.schema, resolveSchema);
		lines.push(
			'  -H "Content-Type: application/json"',
			`  -d '${JSON.stringify(example ?? {}).replace(/'/g, "'\\''")}'`,
		);
	}

	return lines.join(' \\\n');
}

function paramType(param) {
	const schema = param.schema ?? Object.values(param.content ?? {})[0]?.schema;
	if (!schema) return 'string';
	if (schema.type === 'array') return `${schema.items?.type ?? 'string'}[]`;
	return schema.type ?? (schema.format === 'binary' ? 'file' : 'object');
}

/** Replaces `#/components/schemas/X` with `#/schemas/X` and records X. */
function localRefs(value, used) {
	if (Array.isArray(value)) return value.map((item) => localRefs(item, used));
	if (!value || typeof value !== 'object') return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => {
			if (key === '$ref' && typeof item === 'string' && item.startsWith('#/components/schemas/')) {
				const name = item.slice('#/components/schemas/'.length);
				used.add(name);
				return [key, `#/schemas/${name}`];
			}
			return [key, localRefs(item, used)];
		}),
	);
}

/** Every string of the output without the brand word of FR-047 (one example value of the static description has it). */
function rebrand(value) {
	if (typeof value === 'string') return value.replace(BRAND, 'Backoffice');
	if (Array.isArray(value)) return value.map(rebrand);
	if (value && typeof value === 'object')
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v)]));
	return value;
}

/** The resources of the static description and the supplement (data-model §3). */
export function buildResources(spec, supplements) {
	const components = clone(spec.components);
	const tags = new Map(spec.tags.map((tag) => [tag.name, { ...tag, lang: 'en' }]));
	const sources = [{ paths: spec.paths, lang: 'en' }];

	for (const { file, doc } of supplements) {
		for (const tag of doc.tags ?? []) {
			if (tags.has(tag.name)) throw new Error(`sync-docs-api: ${file} defines the tag ${tag.name} again`);
			tags.set(tag.name, { ...tag, lang: tag['x-lang'] ?? 'vi' });
			if (tag['x-crud']) sources.push({ paths: expandCrud(tag), lang: tag['x-lang'] ?? 'vi', crud: tag['x-crud'] });
		}

		for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
			if (components.schemas[name]) throw new Error(`sync-docs-api: ${file} defines the schema ${name} again`);
			components.schemas[name] = { ...schema, 'x-lang': 'vi' };
		}

		if (doc.paths) sources.push({ paths: doc.paths, lang: doc['x-lang'] ?? 'vi' });
	}

	const resolve = (ref) => {
		const [, , group, name] = ref.split('/');
		const found = components[group]?.[name];
		if (!found) throw new Error(`sync-docs-api: unknown reference ${ref}`);
		return found;
	};

	const resources = new Map();
	const excluded = [];

	for (const source of sources) {
		for (const [path, item] of Object.entries(source.paths)) {
			for (const method of METHODS) {
				const operation = item[method];
				if (!operation) continue;

				if (operation.operationId in EXCLUDED) {
					excluded.push(operation.operationId);
					continue;
				}

				const tagName = operation.tags?.[0];
				const tag = tags.get(tagName);
				if (!tag) throw new Error(`sync-docs-api: ${method.toUpperCase()} ${path} has no known tag`);

				if (!resources.has(tagName)) {
					resources.set(tagName, {
						tag,
						id: slug(tagName),
						backofficeOnly: tag['x-backoffice-only'] === true,
						operations: [],
						used: new Set(),
					});
				}

				const resource = resources.get(tagName);
				const params = (operation.parameters ?? []).map((param) =>
					param.$ref ? { ...resolve(param.$ref), lang: 'en' } : { ...param, lang: source.lang },
				);
				const toParam = (param) => ({
					name: param.name,
					type: paramType(param),
					required: param.required === true,
					description: param.description ?? '',
					lang: param.lang,
				});

				const request = operation.requestBody?.$ref ? resolve(operation.requestBody.$ref) : operation.requestBody;
				const contentType = request?.content
					? 'application/json' in request.content
						? 'application/json'
						: Object.keys(request.content)[0]
					: undefined;
				const body = contentType
					? { contentType, required: request.required === true, schema: request.content[contentType].schema ?? {} }
					: undefined;

				const responses = Object.entries(operation.responses ?? {}).map(([status, raw]) => {
					const response = raw.$ref ? resolve(raw.$ref) : raw;
					const schema = response.content?.['application/json']?.schema;
					return { status: String(status), description: response.description ?? '', ...(schema ? { schema } : {}) };
				});

				const success = responses.find((response) => /^2/.test(response.status) && response.schema);
				const access =
					operation['x-access'] ?? (resource.backofficeOnly ? (source.crud?.access ?? 'admin') : undefined);
				const query = params.filter((param) => param.in === 'query').map(toParam);
				const upper = method.toUpperCase();

				resource.operations.push({
					id: operation.operationId,
					method: upper,
					path,
					summary: operation.summary ?? operation.operationId,
					description: operation.description ?? '',
					lang: source.lang,
					query,
					pathParams: params.filter((param) => param.in === 'path').map(toParam),
					...(body ? { body: { ...body, schema: localRefs(body.schema, resource.used) } } : {}),
					responses: responses.map((response) =>
						response.schema ? { ...response, schema: localRefs(response.schema, resource.used) } : response,
					),
					rest: restExample(
						upper,
						path,
						body,
						query,
						resolve,
						access ?? (tagName === 'Authentication' ? 'public' : undefined),
					),
					graphql: graphqlExample(operation.operationId, upper, path, tag),
					...(success ? { responseExample: buildExample(success.schema, resolve) } : {}),
					backofficeOnly: resource.backofficeOnly,
					...(access ? { access } : {}),
					...(source.crud?.['access-note'] && path.startsWith(source.crud.path)
						? { accessNote: source.crud['access-note'] }
						: {}),
				});
			}
		}
	}

	const out = [...resources.values()]
		.map((resource) => {
			const anchors = new Map();
			const operations = resource.operations.map((operation) => {
				const base = slug(operation.summary);
				const count = (anchors.get(base) ?? 0) + 1;
				anchors.set(base, count);
				return { ...operation, anchor: count === 1 ? base : `${base}-${count}` };
			});

			const schemas = {};
			for (const name of [...resource.used].sort()) {
				const nested = new Set();
				schemas[name] = localRefs(components.schemas[name], nested);
			}

			return rebrand({
				$source:
					'libs/specs/dist/openapi.json + apps/web/src/docs/api/supplement, generated by apps/web/scripts/sync-docs-api.mjs',
				id: resource.id,
				name: resource.tag.name,
				description: resource.tag.description ?? '',
				lang: resource.tag.lang,
				...(resource.tag['x-collection'] ? { collection: resource.tag['x-collection'] } : {}),
				backofficeOnly: resource.backofficeOnly,
				operations,
				schemas,
			});
		})
		.sort((a, b) => Number(a.backofficeOnly) - Number(b.backofficeOnly) || a.name.localeCompare(b.name));

	return { resources: out, excluded: excluded.sort() };
}

/** The files to write: one per resource and index.json; the text of each, with a final newline. */
export function renderFiles(spec, supplements) {
	const { resources } = buildResources(spec, supplements);
	const files = {};

	for (const resource of resources) files[`${resource.id}.json`] = `${JSON.stringify(resource, null, '\t')}\n`;

	files['index.json'] = `${JSON.stringify(
		{
			$source: 'generated by apps/web/scripts/sync-docs-api.mjs',
			resources: resources.map(({ id, name, lang, backofficeOnly, operations }) => ({
				id,
				name,
				lang,
				backofficeOnly,
				operations: operations.length,
			})),
		},
		null,
		'\t',
	)}\n`;

	return files;
}

export function writeFiles(files, outDir = OUT_DIR) {
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	for (const [name, text] of Object.entries(files)) writeFileSync(join(outDir, name), text);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const out = resolve(process.argv[2] ?? OUT_DIR);
	const files = renderFiles(loadSpec(), loadSupplements());
	writeFiles(files, out);
	process.stdout.write(`sync-docs-api: wrote ${Object.keys(files).length} files to ${out}\n`);
}
