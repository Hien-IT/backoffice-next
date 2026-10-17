// Feature 014 US7 (T087, SC-004, contracts/tests.md §4): the write requests a page sends to an API while a scenario runs,
// and their comparable form. The payload specs (src/payload/*.spec.ts) run the same steps on the Directus app and on the
// Backoffice app and compare `normalize` of both lists.
import { expect, type Page, type Request, type Response } from '@playwright/test';
import type { AdminApi } from './api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './config.js';
import { login } from './login.js';
import { apiPath } from './requests.js';

export interface Write {
	method: string;
	/** Path relative to the API, query kept (export, background import). */
	path: string;
	body: unknown;
}

const METHODS = new Set(['POST', 'PATCH', 'DELETE', 'SEARCH']);
// Feature 015 adds the Files and Users modules (files, folders, users); the page tracking write (`last_page`) goes out on
// a timer after each navigation, not from the steps, so it is left out. Feature 016 adds the Settings module (data
// model, roles, policies, permissions, access, settings, translations); feature 017 the Flows editor (flows, operations);
// feature 018 Insights and Notifications (dashboards, panels, notifications).
const PATHS =
	/^\/(items|presets|versions|comments|shares|utils|graphql|files|folders|users|collections|fields|relations|roles|policies|permissions|access|settings|translations|flows|operations|dashboards|panels|notifications)(\/|$)(?!me\/track\/page)/;

/** Names a scenario run writes: `<DATA_PREFIX>-dir` on the Directus app, `<DATA_PREFIX>-bo` on the Backoffice app. */
export const RUN_TAG = { dir: `${DATA_PREFIX}-dir`, bo: `${DATA_PREFIX}-bo` } as const;

/** multipart/form-data: the part names and file names in order (the file bytes are compared elsewhere). */
function multipart(request: Request): unknown {
	const parts = [
		...(request.postData() ?? '').matchAll(/Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?/g),
	];
	return { multipart: parts.map(([, name, filename]) => (filename === undefined ? { name } : { name, filename })) };
}

function bodyOf(request: Request): unknown {
	if ((request.headers()['content-type'] ?? '').startsWith('multipart/form-data')) return multipart(request);
	const text = request.postData();
	if (!text) return null;

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export interface Recorded {
	writes: Write[];
	/** Keys of the rows the POSTs created (`data.id` of the answers), in answer order: they differ between runs. */
	keys: (string | number)[];
}

/**
 * Records the parts of the FormData bodies the page sends (name, and file name for files): Chromium gives no post data
 * for an XHR file upload (the Directus app's import), so recordWrites reads these instead. Call before the page loads.
 */
export async function captureFormData(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const parts: unknown[] = [];
		(window as unknown as { __formDataParts: unknown[] }).__formDataParts = parts;
		const describe = (body: unknown) => {
			if (!(body instanceof FormData)) return undefined;
			const described: unknown[] = [];
			body.forEach((v, name) => described.push(v instanceof File ? { name, filename: v.name } : { name }));
			return described;
		};
		const send = XMLHttpRequest.prototype.send;
		XMLHttpRequest.prototype.send = function (body) {
			const described = describe(body);
			if (described) parts.push({ multipart: described });
			return send.call(this, body);
		};
		const fetch = window.fetch;
		window.fetch = function (input, init) {
			const described = describe(init?.body);
			if (described) parts.push({ multipart: described });
			return fetch.call(this, input, init);
		};
	});
}

/** Runs `steps` and returns the writes `page` sent to `api` meanwhile, in send order. */
export async function recordWrites(page: Page, api: string, steps: () => Promise<void>): Promise<Recorded> {
	const recorded: Recorded = { writes: [], keys: [] };
	const answers: Promise<void>[] = [];
	const isWrite = (request: Request, path: string | undefined): path is string =>
		path !== undefined && METHODS.has(request.method()) && PATHS.test(path);

	const onRequest = (request: Request) => {
		const path = apiPath(request.url(), api);
		if (!isWrite(request, path)) return;
		recorded.writes.push({
			method: request.method(),
			path: path + new URL(request.url()).search,
			body: bodyOf(request),
		});
	};

	const onResponse = (response: Response) => {
		const request = response.request();
		if (request.method() !== 'POST' || !isWrite(request, apiPath(request.url(), api))) return;
		answers.push(
			response
				.json()
				.then(({ data }) => {
					for (const row of [data].flat()) if (row?.id !== undefined) recorded.keys.push(row.id);
				})
				.catch(() => undefined),
		);
	};

	page.on('request', onRequest);
	page.on('response', onResponse);

	try {
		await steps();
		// Debounced writes (preset auto-save) go out after the last step. Not networkidle: the Directus app keeps
		// outside requests (tiles, docs) open.
		await page.waitForTimeout(1_500);
		await Promise.all(answers);
		// ponytail: assumes every FormData the page sent during the steps went to a recorded write (true for import).
		const parts = await page.evaluate(() => (window as unknown as { __formDataParts?: unknown[] }).__formDataParts);
		const uploads = recorded.writes.filter((w) => (w.body as { multipart?: unknown })?.multipart);
		if (parts?.length === uploads.length) uploads.forEach((w, i) => (w.body = parts[i]));
	} finally {
		page.off('request', onRequest);
		page.off('response', onResponse);
	}

	return recorded;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g;
const HASH = /^[0-9a-f]{40}$/;
const PREFIX = new RegExp(`${DATA_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-dir|-bo)?`, 'g');

function text(value: string, ids: Map<string, string>): string {
	if (ids.has(value)) return ids.get(value)!;
	// Keys inside a string too: the GraphQL query of "save as copy" (`bo_content_by_id (id: "93")`).
	for (const [id, marker] of ids) value = value.replace(new RegExp(`(?<![\\w-])${id}(?![\\w-])`, 'g'), marker);
	return value.replace(PREFIX, '<prefix>').replace(UUID, '<uuid>').replace(ISO_TIME, '<ts>');
}

function value(input: unknown, ids: Map<string, string>, key?: string, inBlocks = false): unknown {
	if (typeof input === 'number' && ids.has(String(input))) return ids.get(String(input));
	// Block editor (editorjs) output: `time` of the save and generated block ids.
	if (key === 'time' && typeof input === 'number') return '<time>';
	if (key === 'id' && inBlocks && typeof input === 'string') return '<block-id>';
	// Version promote: the hash of the main item, whose values differ between runs.
	if (key === 'mainHash' && typeof input === 'string' && HASH.test(input)) return '<hash>';
	if (typeof input === 'string') return text(input, ids);
	if (Array.isArray(input)) return input.map((v) => value(v, ids, undefined, inBlocks || key === 'blocks'));

	if (input && typeof input === 'object') {
		return Object.fromEntries(
			Object.keys(input)
				.sort()
				.map((k) => [k, value((input as Record<string, unknown>)[k], ids, k, inBlocks && k !== 'data')]),
		);
	}

	return input;
}

/**
 * The comparable form of `writes` (contracts/tests.md §4): send order kept, object keys sorted, DATA_PREFIX and run tags
 * → `<prefix>`, uuids → `<uuid>`, ISO times → `<ts>`, integer path segments → `<id>`, block editor `time`/block `id`
 * replaced, `mainHash` → `<hash>`. Keys created by the run (they differ between runs) become `<id1>`, `<id2>`... wherever
 * they appear as a whole value or path segment. `ids` are keys the spec created before recording (set-up rows), then come
 * the keys of `recorded`.
 */
export function normalize(recorded: Recorded, ids: (string | number)[] = []): Write[] {
	const known = new Map([...ids, ...recorded.keys].map((id, i) => [String(id), `<id${i + 1}>`]));

	return recorded.writes.map((write) => {
		const [pathname, query] = write.path.split('?') as [string, string | undefined];
		const path = pathname
			.split('/')
			.map(
				(segment) => known.get(decodeURIComponent(segment)) ?? (/^\d+$/.test(segment) ? '<id>' : text(segment, known)),
			)
			.join('/');

		return {
			method: write.method,
			path: query === undefined ? path : `${path}?${text(decodeURIComponent(query), known)}`,
			body: value(write.body, known),
		};
	});
}

/** `METHOD path` of each normalized write: what a scenario is expected to send, checked before the bodies. */
export function calls(writes: Write[]): string[] {
	return writes.map((w) => `${w.method} ${w.path}`);
}

/** Signs in to the Backoffice app as the admin, from the content module (last_page reset like the Directus run). */
export async function signInBackoffice(
	page: Page,
	api: AdminApi,
	user: { email: string; password: string; id?: string } = ADMIN,
): Promise<void> {
	await api.call('PATCH', user.id ? `/users/${user.id}` : '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(CONTENT_URL);
}

/**
 * Feature 017 (contracts/components.md §6): operation keys either app generates end in random characters
 * (`condition_ab12c`, a duplicate `log_ab12c`): `key` values lose them (`condition_*`). Run after `normalize`.
 */
export function normalizeFlowsBody(writes: Write[]): Write[] {
	const strip = (input: unknown, key?: string): unknown => {
		if (key === 'key' && typeof input === 'string') return input.replace(/_[a-z0-9]{5}$/, '_*');
		if (Array.isArray(input)) return input.map((v) => strip(v));
		if (input && typeof input === 'object')
			return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, strip(v, k)]));
		return input;
	};
	return writes.map((write) => ({ ...write, path: canonicalPath(write.path), body: strip(write.body) }));
}

/**
 * Feature 017: the query of `path` as one JSON object, so the Directus app (axios, `fields[]=id`, `filter[a][_eq]=x`) and
 * the Backoffice app (@directus/sdk, `fields=id`, `filter={"a":{"_eq":"x"}}`) compare by meaning: bracket keys nest, a
 * JSON value is parsed, `fields` is a sorted list, `sort` a list in its order (feature 018), leaves are strings, and
 * `page=0` (ignored by the API) is dropped.
 */
export function canonicalPath(path: string): string {
	const [pathname, search] = path.split('?') as [string, string | undefined];
	if (search === undefined) return path;
	const query: Record<string, unknown> = {};
	for (const [raw, value] of new URLSearchParams(search)) {
		if (raw === 'page' && value === '0') continue;
		const list = raw.endsWith('[]');
		const keys = raw
			.slice(0, list ? -2 : undefined)
			.replace(/\]/g, '')
			.split('[');
		const parsed: unknown = /^[[{]/.test(value) ? JSON.parse(value) : value;
		let target = query;
		for (const key of keys.slice(0, -1)) target = (target[key] ??= {}) as Record<string, unknown>;
		const last = keys.at(-1)!;
		if (list) ((target[last] ??= []) as unknown[]).push(parsed);
		else target[last] = parsed;
	}
	// `a[0][b]` nests as { 0: ... }: objects with keys 0..n become arrays; leaves become strings.
	const tidy = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(tidy);
		if (input && typeof input === 'object') {
			const entries = Object.entries(input);
			if (entries.length > 0 && entries.every(([k], i) => k === String(i))) return entries.map(([, v]) => tidy(v));
			return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, tidy(v)]));
		}
		return String(input);
	};
	// `sort[]=a` (axios) and `sort=a,b` (@directus/sdk): a list in its order.
	if (query['sort'] !== undefined) query['sort'] = [query['sort']].flat().flatMap((s) => String(s).split(','));
	const fields = query['fields'];
	if (fields !== undefined)
		query['fields'] = [fields]
			.flat()
			.flatMap((f) => String(f).split(','))
			.sort();
	return `${pathname}?${JSON.stringify(tidy(query))}`;
}

/**
 * Feature 018 (contracts/components.md §8, data-model §5): a GraphQL document of the panels with its aliases
 * `query_<hash>` as `query_*`, whitespace collapsed and the aliased queries sorted: their order follows the order of the
 * panels in each app's store (sorted by dashboard key only, so not stable between runs).
 */
export function normalizeGraphql(query: string): string {
	const text = query
		.replace(/query_[0-9a-f]+/g, 'query_*')
		.replace(/\s+/g, ' ')
		.trim();
	const inner = /^query \{ (.*) \}$/.exec(text);
	return inner
		? `query { ${inner[1]!
				.split(/ (?=query_\*: )/)
				.sort()
				.join(' ')} }`
		: text;
}

/**
 * Feature 018 (contracts/tests.md §4): after `normalize`, REST queries by meaning (`canonicalPath`), GraphQL documents
 * through `normalizeGraphql`, the panel arrays of `POST/PATCH/DELETE /panels` sorted, then the writes sorted by
 * (method, path, body): the `/panels` requests of a Save and the reads after it go out in parallel.
 */
export function normalizeInsightsBody(writes: Write[]): Write[] {
	const text = (v: unknown) => JSON.stringify(v);
	const body = (input: unknown): unknown => {
		if (Array.isArray(input)) return [...input].sort((a, b) => text(a).localeCompare(text(b)));
		const query = (input as { query?: unknown } | null)?.query;
		return typeof query === 'string' ? { ...(input as object), query: normalizeGraphql(query) } : input;
	};
	return writes
		.map((write) => ({ ...write, path: canonicalPath(write.path), body: body(write.body) }))
		.sort((a, b) => text(a).localeCompare(text(b)));
}
