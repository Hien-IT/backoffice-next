// Feature 005, US5 (FR-030 to FR-033, FR-045, contracts/events-bus.md §5): the websocket.event messages that each app
// publishes on the Redis bus for the same writes, at the websocket pair (WEBSOCKETS_ENABLED and
// WEBSOCKETS_REST_ENABLED); none at the main pair. Each app writes its own collections; the messages of one write are
// the ones received from its request until 2 seconds without a new one, compared in order once ids, uuids and the
// collection names are replaced by labels.
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, appRequest } from '../directus-api.js';
import { profileUrls } from '../profiles.js';
import { decodeMessage, newConnection } from '../redis.js';

const run = Math.random().toString(16).slice(2, 10);
const APPS = ['directus', 'backoffice'] as const;
type App = (typeof APPS)[number];

const names = (app: App) => ({
	articles: `parity_bus_${app}_${run}`,
	comments: `parity_bus_c_${app}_${run}`,
	home: `parity_bus_s_${app}_${run}`,
	// Feature 006 (FR-051): a collection made and removed through the data model routes of the app.
	model: `parity_bus_m_${app}_${run}`,
});

const received: { channel: string; message: any }[] = [];
let subscriber: Redis;
let token: string;

const quiet = async (ms = 2000) => {
	let count = -1;

	while (count !== received.length) {
		count = received.length;
		await new Promise((resolve) => setTimeout(resolve, ms));
	}
};

async function call(base: string, method: string, path: string, body?: unknown) {
	const res = await fetch(new URL(path, base), {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			...(body === undefined ? {} : { 'content-type': 'application/json' }),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

	const text = await res.text();
	if (res.status >= 400) throw new Error(`${method} ${path}: ${res.status} ${text}`);
	return text ? JSON.parse(text) : undefined;
}

// Serial keys: their value depends on the rows written before (activity, revisions, permissions; feature 006 the
// metadata rows of fields and relations).
const SERIAL = new Set([
	'directus_activity',
	'directus_revisions',
	'directus_permissions',
	'directus_fields',
	'directus_relations',
]);

function serials(message: any): any {
	const out = structuredClone(message);
	const payload = out.payload;

	if (SERIAL.has(out.collection)) {
		if ('key' in out) out.key = '<serial>';
		if (Array.isArray(out.keys)) out.keys = out.keys.map(() => '<serial>');
		if (Array.isArray(payload)) out.payload = payload.map(() => '<serial>');
	}

	if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
		if ('activity' in payload) payload.activity = '<serial>';
		if (out.collection === 'directus_revisions' && 'parent' in payload) payload.parent = '<serial>';
		if (SERIAL.has(payload.collection) && 'item' in payload) payload.item = '<serial>';
		// Feature 006: the action payload of a directus_relations row carries its key.
		if (SERIAL.has(out.collection) && typeof payload.key === 'number') payload.key = '<serial>';
		// Feature 006: the revision of a directus_fields or directus_relations row holds the row with its id.
		if (SERIAL.has(payload.collection) && payload.data && typeof payload.data === 'object' && 'id' in payload.data) {
			payload.data.id = '<serial>';
		}
	}

	return out;
}

/** Serial keys, ids and uuids by order of appearance, the collection names of the app by their role. */
function normalize(messages: unknown[], app: App): unknown[] {
	let text = JSON.stringify(messages.map(serials));
	for (const [role, name] of Object.entries(names(app))) text = text.split(name).join(`<${role}>`);
	text = text.replaceAll(`bus-${app}-${run}`, '<run>');
	// Feature 008: the version rows carry their times and the _date stamp of the delta.
	text = text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<time>');

	const labels = new Map<string, string>();
	text = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (uuid) => {
		if (!labels.has(uuid)) labels.set(uuid, `<uuid${labels.size + 1}>`);
		return labels.get(uuid)!;
	});

	return JSON.parse(text);
}

/** The writes of contracts/events-bus.md §5, at one app; the messages of each write. */
async function scenario(app: App, base: string): Promise<Record<string, unknown[]>> {
	const { articles, home } = names(app);
	const out: Record<string, unknown[]> = {};

	async function step(name: string, fn: () => Promise<unknown>) {
		await quiet(300);
		received.length = 0;
		await fn();
		await quiet();
		// Only this file writes while it runs (no file parallelism): every message of the window belongs to the step.
		out[name] = normalize(
			received.map((r) => r.message),
			app,
		);
	}

	await step('create one', () => call(base, 'POST', `/items/${articles}`, { title: 'one' }));
	await step('create many', () => call(base, 'POST', `/items/${articles}`, [{ title: 'two' }, { title: 'three' }]));
	await step('update one', () => call(base, 'PATCH', `/items/${articles}/1`, { title: 'one!' }));
	await step('update many', () => call(base, 'PATCH', `/items/${articles}`, { keys: [1, 2], data: { title: 'many' } }));
	await step('update batch', () =>
		call(base, 'PATCH', `/items/${articles}`, [
			{ id: 1, title: 'a' },
			{ id: 2, title: 'b' },
		]),
	);
	await step('update by query', () =>
		call(base, 'PATCH', `/items/${articles}`, { query: { filter: { id: { _eq: 3 } } }, data: { title: 'q' } }),
	);
	await step('nested o2m create', () =>
		call(base, 'POST', `/items/${articles}`, { title: 'parent', comments: [{ body: 'c1' }, { body: 'c2' }] }),
	);
	await step('delete one', () => call(base, 'DELETE', `/items/${articles}/1`));
	await step('delete many', () => call(base, 'DELETE', `/items/${articles}`, [2, 3]));
	await step('delete by query', () =>
		call(base, 'DELETE', `/items/${articles}`, { query: { filter: { title: { _eq: 'parent' } } } }),
	);
	await step('singleton create', () => call(base, 'PATCH', `/items/${home}`, { headline: 'first' }));
	await step('singleton update', () => call(base, 'PATCH', `/items/${home}`, { headline: 'second' }));

	// Feature 008 (spec FR-004, FR-038): versions.* of the system collection and items.promote.
	let item = 0;
	let version = '';
	await step(
		'item for a version',
		async () => (item = (await call(base, 'POST', `/items/${articles}`, { title: 'v' })).data.id),
	);
	await step(
		'versions create',
		async () =>
			(version = (
				await call(base, 'POST', '/versions', { key: 'draft', name: null, collection: articles, item: String(item) })
			).data.id),
	);
	await step('versions save', () => call(base, 'POST', `/versions/${version}/save`, { title: 'draft' }));
	await step('versions promote', async () => {
		const { mainHash } = (await call(base, 'GET', `/versions/${version}/compare`)).data;
		await call(base, 'POST', `/versions/${version}/promote`, { mainHash });
	});
	await step('versions update', () => call(base, 'PATCH', `/versions/${version}`, { name: 'renamed' }));
	await step('versions delete', () => call(base, 'DELETE', `/versions/${version}`));

	// Feature 006 (FR-051): collections.*, fields.*, relations.* of the data model routes.
	const { model } = names(app);
	const id = {
		field: 'id',
		type: 'integer',
		meta: { hidden: true },
		schema: { is_primary_key: true, has_auto_increment: true },
	};
	await step('collections create', () =>
		call(base, 'POST', '/collections', { collection: model, schema: {}, meta: {}, fields: [id] }),
	);
	await step('collections update', () => call(base, 'PATCH', `/collections/${model}`, { meta: { note: 'bus' } }));
	await step('fields create', () =>
		call(base, 'POST', `/fields/${model}`, { field: 'title', type: 'string', meta: {} }),
	);
	await step('fields update', () => call(base, 'PATCH', `/fields/${model}/title`, { meta: { note: 'bus' } }));
	await step('fields create m2o', () =>
		call(base, 'POST', `/fields/${model}`, { field: 'article', type: 'integer', meta: { special: ['m2o'] } }),
	);
	await step('relations create', () =>
		call(base, 'POST', '/relations', { collection: model, field: 'article', related_collection: articles }),
	);
	await step('relations update', () =>
		call(base, 'PATCH', `/relations/${model}/article`, {
			collection: model,
			field: 'article',
			related_collection: articles,
			schema: { on_delete: 'CASCADE' },
			meta: { one_deselect_action: 'delete' },
		}),
	);
	await step('relations delete', () => call(base, 'DELETE', `/relations/${model}/article`));
	await step('fields delete', () => call(base, 'DELETE', `/fields/${model}/title`));
	await step('collections delete', () => call(base, 'DELETE', `/collections/${model}`));

	let role = '';
	let policy = '';
	let user = '';
	await step(
		'roles create',
		async () => (role = (await call(base, 'POST', '/roles', { name: `bus-${app}-${run}` })).data.id),
	);
	await step(
		'policies create',
		async () => (policy = (await call(base, 'POST', '/policies', { name: `bus-${app}-${run}` })).data.id),
	);
	await step('access create', () => call(base, 'POST', '/access', { role, policy }));
	await step('permissions create', () =>
		call(base, 'POST', '/permissions', { policy, collection: articles, action: 'read', fields: ['*'] }),
	);
	await step(
		'users create',
		async () =>
			(user = (
				await call(base, 'POST', '/users', { email: `bus-${app}-${run}@example.com`, password: 'secret-R-07', role })
			).data.id),
	);
	await step('users update', () => call(base, 'PATCH', `/users/${user}`, { first_name: `bus-${app}-${run}` }));
	await step('users me track page', () =>
		call(base, 'PATCH', '/users/me/track/page', { last_page: `/content/bus-${app}-${run}` }),
	);
	await step('users delete', () => call(base, 'DELETE', `/users/${user}`));
	await step('policies delete', () => call(base, 'DELETE', `/policies/${policy}`));
	await step('roles delete', () => call(base, 'DELETE', `/roles/${role}`));

	return out;
}

const pair = profileUrls('websocket');

describe.runIf(pair)('websocket.event bus (pair websocket)', () => {
	beforeAll(async () => {
		token = await adminToken('directus');
		subscriber = newConnection();
		subscriber.on('pmessageBuffer', (_pattern, channel, message) =>
			received.push({ channel: channel.toString(), message: decodeMessage(message) }),
		);
		await subscriber.psubscribe('*websocket.event');

		for (const app of APPS) {
			const { articles, comments, home } = names(app);
			const id = {
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			};
			await appRequest('directus', 'POST', '/collections', {
				collection: articles,
				schema: {},
				// Feature 008: content versioning for the versions steps.
				meta: { versioning: true },
				fields: [id, { field: 'title', type: 'string' }],
			});
			await appRequest('directus', 'POST', '/collections', {
				collection: comments,
				schema: {},
				meta: {},
				fields: [id, { field: 'body', type: 'string' }, { field: 'article', type: 'integer' }],
			});
			await appRequest('directus', 'POST', `/fields/${articles}`, {
				field: 'comments',
				type: 'alias',
				meta: { special: ['o2m'] },
			});
			await appRequest('directus', 'POST', '/relations', {
				collection: comments,
				field: 'article',
				related_collection: articles,
				meta: { one_field: 'comments' },
				schema: { on_delete: 'SET NULL' },
			});
			await appRequest('directus', 'POST', '/collections', {
				collection: home,
				schema: {},
				meta: { singleton: true },
				fields: [id, { field: 'headline', type: 'string' }],
			});
		}
	}, 300_000);

	afterAll(async () => {
		await subscriber?.quit();

		for (const app of APPS) {
			for (const collection of [names(app).model, names(app).comments, names(app).articles, names(app).home]) {
				await appRequest('directus', 'DELETE', `/collections/${collection}`).catch(() => undefined);
			}
		}
	}, 300_000);

	it('the same messages, in the same order, for every write (R-07: the password is in users.create)', async () => {
		const directus = await scenario('directus', pair!.directusUrl!);
		const backoffice = await scenario('backoffice', pair!.backofficeUrl!);

		// One create: its activity, its revision, then the item (contracts/events-bus.md §5).
		expect(directus['create one']!.map((m: any) => m.collection)).toEqual([
			'directus_activity',
			'directus_revisions',
			'<articles>',
		]);
		expect(JSON.stringify(directus['users create'])).toContain('secret-R-07');

		for (const step of Object.keys(directus)) expect(backoffice[step], step).toEqual(directus[step]);
	}, 300_000);
});

describe('main pair (WEBSOCKETS_ENABLED=false)', () => {
	it('no message for the writes of either app', async () => {
		token = await adminToken('directus');
		const collection = `parity_bus_main_${run}`;
		const listener = newConnection();
		const messages: unknown[] = [];
		listener.on('pmessageBuffer', (_p, _c, message) => messages.push(decodeMessage(message)));
		await listener.psubscribe('*websocket.event');

		try {
			await appRequest('directus', 'POST', '/collections', {
				collection,
				schema: {},
				meta: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
					{ field: 'title', type: 'string' },
				],
			});
			messages.length = 0;

			for (const base of [process.env['DIRECTUS_URL']!, process.env['BACKOFFICE_URL']!]) {
				const created = await call(base, 'POST', `/items/${collection}`, { title: 'x' });
				await call(base, 'PATCH', `/items/${collection}/${created.data.id}`, { title: 'y' });
				await call(base, 'DELETE', `/items/${collection}/${created.data.id}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 2000));
			expect(messages.filter((m) => JSON.stringify(m).includes(collection))).toEqual([]);
		} finally {
			await listener.quit();
			await appRequest('directus', 'DELETE', `/collections/${collection}`).catch(() => undefined);
		}
	}, 120_000);
});
