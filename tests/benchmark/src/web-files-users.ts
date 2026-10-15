// Benchmark of the Files and Users module screens (feature 015, T096, US7, research R10), modelled on web-content.ts.
// Seed: one folder with FILES files of 1 KB uploaded to the Directus API (multipart, 20 in parallel; half text/plain,
// half application/octet-stream) and USERS users inserted on the host (half active, half suspended), all named with
// one `bench-fu-<hex>` prefix and deleted in a `finally`. Playwright chromium signs in to the Directus app (8155/admin)
// and to the Backoffice web app behind a proxy to Directus (8171) and to the new API (8172). Each run measures, the
// three apps in turn: the first page of the folder (cards layout, goto until the 25th card shows) and of
// /users/all (tabular, goto until row 25 shows), the next page, a filter (files by `type`, users by `status`, written in
// the admin preset before the goto). BENCH_RUNS runs (11) after one unmeasured run, nearest-rank p95, requests to
// /files or /users per action (list + count). API reads skip the shared response cache (Cache-Control: no-store,
// CACHE_SKIP_ALLOWED=true). Fails when a web app's p95 is more than TOLERANCE above the Directus app's. Needs
// `benchmark:env-up-web` first.
import { randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { type Browser, type BrowserContext, chromium, type Page } from '@playwright/test';
import { TOLERANCE } from './compare.ts';
import { deleteFiles } from './seed-files.ts';
import { db, directus } from './seed-permissions.ts';

const RUNS = Number(process.env['BENCH_RUNS'] ?? 11);
const FILES = Number(process.env['BENCH_WEB_FILES'] ?? 10_000);
const USERS = Number(process.env['BENCH_WEB_USERS'] ?? 10_000);
const PARALLEL = 20;
const APPS = {
	'Directus app': process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155',
	'web → Directus': process.env['WEB_DIRECTUS_URL'] ?? 'http://127.0.0.1:8171',
	'web → API': process.env['WEB_API_URL'] ?? 'http://127.0.0.1:8172',
};
type App = keyof typeof APPS;

const ACTIONS = [
	'files: first page',
	'files: next page',
	'files: filter type (preset)',
	'users: first page',
	'users: next page',
	'users: filter status (preset)',
] as const;
type Action = (typeof ACTIONS)[number];

const env = readFileSync(new URL('../../parity/env/postgres.env', import.meta.url), 'utf8');
const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const TIMEOUT = 120_000;
const tag = `bench-fu-${randomBytes(3).toString('hex')}`;
const name = (i: number) => `${tag}-${String(i).padStart(5, '0')}`;

const timings = {} as Record<App, Record<Action, number[]>>;
const requests = {} as Record<App, Record<Action, string[]>>;

function resetResults() {
	for (const app of Object.keys(APPS) as App[]) {
		timings[app] = {} as Record<Action, number[]>;
		requests[app] = {} as Record<Action, string[]>;
		for (const action of ACTIONS) {
			timings[app][action] = [];
			requests[app][action] = [];
		}
	}
}

let token: string | undefined;

async function login(): Promise<string> {
	const res = await fetch(`${APPS['Directus app']}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: envValue('ADMIN_EMAIL'), password: envValue('ADMIN_PASSWORD') }),
	});
	if (!res.ok) throw new Error(`login: ${res.status}`);
	return ((await res.json()) as any).data.access_token as string;
}

/** POST /files multipart; the fields go before the file so Directus applies them to the row. */
async function upload(folder: string, i: number): Promise<void> {
	const form = new FormData();
	form.set('storage', 'local');
	form.set('folder', folder);
	form.set('title', name(i));
	const type = i % 2 === 0 ? 'text/plain' : 'application/octet-stream';
	form.set('file', new Blob([randomBytes(512).toString('hex')], { type }), `${name(i)}.txt`);
	token ??= await login();
	const res = await fetch(`${APPS['Directus app']}/files`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` },
		body: form,
	});
	// The seed may outlast ACCESS_TOKEN_TTL: log in again once.
	if (res.status === 401) {
		token = undefined;
		return upload(folder, i);
	}
	if (!res.ok) throw new Error(`upload ${name(i)}: ${res.status} ${await res.text()}`);
	await res.arrayBuffer();
}

/** Seeds the files into `folder` and the users; returns the seconds it took. */
async function seed(folder: string): Promise<number> {
	const started = Date.now();
	let next = 0;
	await Promise.all(
		Array.from({ length: PARALLEL }, async () => {
			while (next < FILES) await upload(folder, next++);
		}),
	);

	// Rows only, on the host like seed-permissions.ts (the API would take minutes).
	const users = Array.from({ length: USERS }, (_, i) => ({
		id: randomUUID(),
		email: `${name(i)}@example.com`,
		first_name: name(i),
		status: i % 2 === 0 ? 'active' : 'suspended',
		provider: 'default',
	}));
	for (let i = 0; i < users.length; i += 500) await db('directus_users').insert(users.slice(i, i + 500));

	return Math.round((Date.now() - started) / 1000);
}

async function cleanup(folder: string | undefined, me: string | undefined): Promise<void> {
	if (me)
		await directus('DELETE', '/presets', {
			query: {
				filter: {
					collection: { _in: ['directus_files', 'directus_users'] },
					user: { _eq: me },
					bookmark: { _null: true },
				},
			},
		});
	await deleteFiles(tag);
	if (folder) await directus('DELETE', `/folders/${folder}`);
	await db('directus_users').where('email', 'like', `${tag}%`).delete();
	await db.destroy();
}

/** The admin presets of directus_files / directus_users (shared by the three apps: same DB), written before each goto. */
async function resetPreset(me: string, collection: 'directus_files' | 'directus_users', filter: object | null) {
	await directus('DELETE', '/presets', {
		query: { filter: { collection: { _eq: collection }, user: { _eq: me }, bookmark: { _null: true } } },
	});
	// The Directus app's systemDefaults (stores/presets.ts); files sorted by title so the cards to wait for are known.
	await directus(
		'POST',
		'/presets',
		collection === 'directus_files'
			? {
					collection,
					user: me,
					layout: 'cards',
					layout_query: { cards: { sort: ['title'], limit: 25 } },
					layout_options: {
						cards: {
							icon: 'insert_drive_file',
							title: '{{ title }}',
							subtitle: '{{ type }} • {{ filesize }}',
							size: 4,
						},
					},
					filter,
				}
			: {
					collection,
					user: me,
					layout: 'tabular',
					layout_query: {
						tabular: { sort: ['email'], fields: ['avatar', 'first_name', 'last_name', 'email', 'role'], limit: 25 },
					},
					filter,
				},
	);
}

// shortcut: signIn, track, p95 and usual are copies of web-content.ts (that file is not ours to change), merge them into
// a shared module when a third web benchmark comes.
async function signIn(browser: Browser, baseURL: string): Promise<BrowserContext> {
	const context = await browser.newContext({
		baseURL,
		viewport: { width: 1440, height: 900 },
		extraHTTPHeaders: { 'cache-control': 'no-store' },
	});
	// The Directus app asks an admin without a project owner to set one: the cookie of "Remind Later" keeps it closed.
	await context.addCookies([{ name: 'license-banner-dismissed', value: 'true', url: baseURL }]);
	const page = await context.newPage();
	await page.goto('/admin/login');
	// Label in the new app, placeholder in the Directus app (en-US strings of both).
	const field = (label: string) =>
		page.getByLabel(label, { exact: true }).or(page.getByPlaceholder(label, { exact: true }));
	await field('Email').fill(envValue('ADMIN_EMAIL'));
	await field('Password').fill(envValue('ADMIN_PASSWORD'));
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: TIMEOUT });
	const later = page.getByRole('button', { name: 'Remind Later' });
	await later
		.waitFor({ timeout: 3_000 })
		.then(() => later.click())
		.catch(() => undefined);
	await page.close();
	return context;
}

/** Counts list and count requests to /files or /users, and waits until the page is quiet. */
function track(page: Page, path: '/files' | '/users') {
	const seen = { list: 0, count: 0 };
	let inflight = 0;
	let last = Date.now();

	page.on('request', (r) => {
		inflight++;
		last = Date.now();
		const url = new URL(r.url());
		if (r.method() !== 'GET' || !url.pathname.endsWith(path)) return;
		seen[[...url.searchParams.keys()].some((k) => k.startsWith('aggregate')) ? 'count' : 'list']++;
	});
	const done = () => {
		inflight--;
		last = Date.now();
	};
	page.on('requestfinished', done);
	page.on('requestfailed', done);

	return {
		/** `lists + counts` since the last call, once no request ran for a second (late counts included). */
		async take(): Promise<string> {
			const started = Date.now();
			while ((inflight > 0 || Date.now() - last < 1000) && Date.now() - started < TIMEOUT) await setTimeout(100);
			const out = `${seen.list} + ${seen.count}`;
			seen.list = seen.count = 0;
			return out;
		},
	};
}

const FIRST_ROW = 'table tbody tr';
const ROW_25 = 'table tbody tr:nth-child(25)';
// A string expression: this project has no DOM types.
const rowChanged = (page: Page, before: string) =>
	page.waitForFunction(`document.querySelector('${FIRST_ROW}')?.textContent !== ${JSON.stringify(before)}`, undefined, {
		timeout: TIMEOUT,
	});
// The card title (`{{ title }}`); the card markup differs between the two apps.
const card = (page: Page, i: number) => page.getByText(name(i), { exact: true }).waitFor({ timeout: TIMEOUT });
// Pages show once the count is back (both apps).
const pageTwo = async (page: Page) => {
	const button = page.getByRole('button', { name: '2', exact: true }).first();
	await button.waitFor({ timeout: TIMEOUT });
	return button;
};

async function record(app: App, action: Action, tracker: ReturnType<typeof track>, run: () => Promise<unknown>) {
	const start = performance.now();
	await run();
	timings[app][action].push(performance.now() - start);
	requests[app][action].push(await tracker.take());
}

async function measure(app: App, context: BrowserContext, me: string, folder: string) {
	const files = `/admin/files/folders/${folder}`;
	const users = '/admin/users/all';

	// Files sorted by title: page 1 ends with 00024, page 2 with 00049, text/plain (even numbers) page 1 with 00048.
	await resetPreset(me, 'directus_files', null);
	let page = await context.newPage();
	let tracker = track(page, '/files');
	await record(app, 'files: first page', tracker, async () => {
		await page.goto(files);
		await card(page, 24);
	});
	let next = await pageTwo(page);
	await record(app, 'files: next page', tracker, async () => {
		await next.click();
		await card(page, 49);
	});
	// Closing drops the debounced preset save, so the next reset is not overwritten.
	await page.close();

	await resetPreset(me, 'directus_files', { type: { _eq: 'text/plain' } });
	page = await context.newPage();
	tracker = track(page, '/files');
	await record(app, 'files: filter type (preset)', tracker, async () => {
		await page.goto(files);
		await card(page, 48);
	});
	await page.close();

	await resetPreset(me, 'directus_users', null);
	page = await context.newPage();
	tracker = track(page, '/users');
	await record(app, 'users: first page', tracker, async () => {
		await page.goto(users);
		await page.locator(ROW_25).waitFor({ timeout: TIMEOUT });
	});
	next = await pageTwo(page);
	const before = (await page.locator(FIRST_ROW).first().textContent()) ?? '';
	await record(app, 'users: next page', tracker, async () => {
		await next.click();
		await rowChanged(page, before);
	});
	await page.close();

	await resetPreset(me, 'directus_users', { status: { _eq: 'suspended' } });
	page = await context.newPage();
	tracker = track(page, '/users');
	await record(app, 'users: filter status (preset)', tracker, async () => {
		await page.goto(users);
		await page.locator(ROW_25).waitFor({ timeout: TIMEOUT });
	});
	await page.close();
}

/** Nearest-rank p95 (with 11 runs: the slowest). */
function p95(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return Math.round(sorted[Math.ceil(0.95 * sorted.length) - 1]!);
}

/** The request split seen in most runs. */
function usual(values: string[]): string {
	const counts = new Map<string, number>();
	for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
}

const started = Date.now();
let passed = true;
let seconds = 0;
let folder: string | undefined;
let me: string | undefined;
let browser: Browser | undefined;
const rows: string[] = [];

try {
	me = ((await directus('GET', '/users/me?fields=id')) as { data: { id: string } }).data.id;
	folder = (await directus('POST', '/folders', { name: tag })).data.id as string;
	seconds = await seed(folder);
	process.stdout.write(`seed: ${seconds} s, ${FILES} files, ${USERS} users (${tag})\n`);

	browser = await chromium.launch();
	const contexts = {} as Record<App, BrowserContext>;
	for (const [app, base] of Object.entries(APPS) as [App, string][]) contexts[app] = await signIn(browser, base);

	// One unmeasured run per app: lazy chunks, schema and permission caches.
	resetResults();
	for (const app of Object.keys(APPS) as App[]) await measure(app, contexts[app], me, folder);
	resetResults();

	for (let i = 0; i < RUNS; i++) {
		for (const app of Object.keys(APPS) as App[]) await measure(app, contexts[app], me, folder);
		process.stdout.write(`run ${i + 1}/${RUNS} done\n`);
	}

	for (const action of ACTIONS) {
		const reference = p95(timings['Directus app'][action]);
		const reasons: string[] = [];
		for (const app of ['web → Directus', 'web → API'] as const) {
			const value = p95(timings[app][action]);
			if (value > reference * (1 + TOLERANCE))
				reasons.push(`${app} ${value} ms is more than ${TOLERANCE * 100}% above ${reference} ms`);
		}
		passed &&= reasons.length === 0;
		const cells = (Object.keys(APPS) as App[]).map((app) => p95(timings[app][action]));
		const split = (Object.keys(APPS) as App[]).map((app) => usual(requests[app][action])).join(' / ');
		rows.push(
			`| ${action} | ${cells.join(' | ')} | ${split} | ${reasons.length ? `FAIL: ${reasons.join('; ')}` : 'ok'} |`,
		);
	}
} finally {
	await browser?.close();
	await cleanup(folder, me);
}

const report = [
	`| Action | p95 ${Object.keys(APPS).join(' (ms) | p95 ')} (ms) | requests list + count (${Object.keys(APPS).join(' / ')}) | Result |`,
	'| --- | --- | --- | --- | --- | --- |',
	...rows,
].join('\n');
const minutes = ((Date.now() - started) / 60_000).toFixed(1);
process.stdout.write(`${report}\n${minutes} min in all\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(
		process.env['GITHUB_STEP_SUMMARY'],
		`## Benchmark web files and users\n\nSeed: ${seconds} s, ${FILES} files of 1 KB in one folder, ${USERS} users; ${RUNS} runs, chromium, ${minutes} min in all.\n\n${report}\n`,
	);

process.exit(passed ? 0 : 1);
