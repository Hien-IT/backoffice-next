// Benchmark of the Content module screen (feature 014, FR-125, SC-003, contracts/tests.md §5, research R14) on the 10
// million rows of seed-items.ts. Playwright chromium signs in to three apps: the Directus app (8155/admin), the
// Backoffice web app behind a proxy to Directus (8171) and behind a proxy to the new API (8172). Each run measures, the
// three apps in turn: the first page (goto until row 25 shows), the next page, a sort on date_created (indexed) and on
// title (not indexed), a filter on status (written in the admin preset before the goto). BENCH_RUNS runs (11), p95,
// requests to /items/bench_articles per action (list + count). API reads skip the shared response cache (Cache-Control:
// no-store, CACHE_SKIP_ALLOWED=true). Fails when the web app's p95 is more than 10% above the Directus app's in either
// configuration; the absolute targets of SC-003 are only reported. Needs `benchmark:env-up-web` first.
import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { type Browser, type BrowserContext, chromium, type Page } from '@playwright/test';
import { TOLERANCE } from './compare.ts';
import { ARTICLES, cleanup, seed } from './seed-items.ts';
import { directus } from './seed-permissions.ts';

const RUNS = Number(process.env['BENCH_RUNS'] ?? 11);
const APPS = {
	'Directus app': process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155',
	'web → Directus': process.env['WEB_DIRECTUS_URL'] ?? 'http://127.0.0.1:8171',
	'web → API': process.env['WEB_API_URL'] ?? 'http://127.0.0.1:8172',
};
type App = keyof typeof APPS;

/** Absolute targets of SC-003 (ms), reported only. */
const ACTIONS = {
	'first page': 2000,
	'next page': 1500,
	'sort date_created (indexed)': 1500,
	'sort title (not indexed)': undefined,
	'filter status (preset)': 1500,
} satisfies Record<string, number | undefined>;
type Action = keyof typeof ACTIONS;

const env = readFileSync(new URL('../../parity/env/postgres.env', import.meta.url), 'utf8');
const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const TIMEOUT = 120_000;

const timings = {} as Record<App, Record<Action, number[]>>;
const requests = {} as Record<App, Record<Action, string[]>>;

for (const app of Object.keys(APPS) as App[]) {
	timings[app] = {} as Record<Action, number[]>;
	requests[app] = {} as Record<Action, string[]>;
	for (const action of Object.keys(ACTIONS) as Action[]) {
		timings[app][action] = [];
		requests[app][action] = [];
	}
}

/** The admin preset of bench_articles (shared by the three apps: same DB), written before each goto. */
async function resetPreset(me: string, filter: Record<string, unknown> | null) {
	await directus('DELETE', '/presets', {
		query: { filter: { collection: { _eq: ARTICLES }, user: { _eq: me }, bookmark: { _null: true } } },
	});
	await directus('POST', '/presets', {
		collection: ARTICLES,
		user: me,
		layout: 'tabular',
		layout_query: { tabular: { fields: ['title', 'status', 'category', 'date_created'], sort: ['id'] } },
		filter,
	});
}

async function signIn(browser: Browser, baseURL: string): Promise<BrowserContext> {
	const context = await browser.newContext({
		baseURL,
		viewport: { width: 1440, height: 900 },
		extraHTTPHeaders: { 'cache-control': 'no-store' },
	});
	// The Directus app asks an admin without a project owner to set one (a dialog over the page): the cookie its
	// "Remind Later" sets keeps it closed (as apps/web-e2e/src/helpers/directus-app.ts).
	await context.addCookies([{ name: 'license-banner-dismissed', value: 'true', url: baseURL }]);
	const page = await context.newPage();
	await page.goto('/admin/login');
	// Label in the new app, placeholder in the Directus app (en-US strings of both).
	const field = (name: string) =>
		page.getByLabel(name, { exact: true }).or(page.getByPlaceholder(name, { exact: true }));
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

/** Counts list and count requests to /items/bench_articles, and waits until the page is quiet. */
function track(page: Page) {
	const seen = { list: 0, count: 0 };
	let inflight = 0;
	let last = Date.now();

	page.on('request', (r) => {
		inflight++;
		last = Date.now();
		const url = new URL(r.url());
		if (r.method() !== 'GET' || !url.pathname.endsWith(`/items/${ARTICLES}`)) return;
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
const firstRow = async (page: Page) => (await page.locator(FIRST_ROW).first().textContent()) ?? '';
// A string expression: this project has no DOM types.
const rowChanged = (page: Page, before: string) =>
	page.waitForFunction(`document.querySelector('${FIRST_ROW}')?.textContent !== ${JSON.stringify(before)}`, undefined, {
		timeout: TIMEOUT,
	});

async function record(app: App, action: Action, tracker: ReturnType<typeof track>, run: () => Promise<unknown>) {
	const start = performance.now();
	await run();
	timings[app][action].push(performance.now() - start);
	requests[app][action].push(await tracker.take());
}

async function sortBy(
	app: App,
	page: Page,
	tracker: ReturnType<typeof track>,
	action: Action,
	header: RegExp,
	menuItem: 'Sort Ascending' | 'Sort Descending',
) {
	// Directus `header-context-menu` of the tabular layout; the new app ports it (same en-US item names).
	await page.getByRole('columnheader', { name: header }).getByRole('button').first().click();
	// The new app's items are menuitemradio (an icon ligature before the label); the Directus app's are plain text.
	const item = page
		.getByRole('menuitemradio', { name: menuItem, exact: true })
		.or(page.getByText(menuItem, { exact: true }))
		.last();
	await item.waitFor({ timeout: TIMEOUT });
	const before = await firstRow(page);
	await record(app, action, tracker, async () => {
		await item.click();
		await rowChanged(page, before);
	});
}

async function measure(app: App, context: BrowserContext, me: string) {
	const url = `/admin/content/${ARTICLES}`;

	await resetPreset(me, null);
	let page = await context.newPage();
	let tracker = track(page);
	await record(app, 'first page', tracker, async () => {
		await page.goto(url);
		await page.locator('table tbody tr:nth-child(25)').waitFor({ timeout: TIMEOUT });
	});

	// Pages show once the count is back (both apps).
	const next = page.getByRole('button', { name: '2', exact: true }).first();
	await next.waitFor({ timeout: TIMEOUT });
	const before = await firstRow(page);
	await record(app, 'next page', tracker, async () => {
		await next.click();
		await rowChanged(page, before);
	});

	// Ascending: the oldest row (id 10,000,000). Descending title: 'delete 99999'. Both differ from the row before.
	await sortBy(app, page, tracker, 'sort date_created (indexed)', /Date Created/, 'Sort Ascending');
	await sortBy(app, page, tracker, 'sort title (not indexed)', /Title/, 'Sort Descending');
	// Closing drops the debounced preset save, so the next reset is not overwritten.
	await page.close();

	await resetPreset(me, { status: { _eq: 'published' } });
	page = await context.newPage();
	tracker = track(page);
	await record(app, 'filter status (preset)', tracker, async () => {
		await page.goto(url);
		await page.locator('table tbody tr:nth-child(25)').waitFor({ timeout: TIMEOUT });
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

const seeded = await seed();
process.stdout.write(`seed: ${seeded.seconds} s, ${ARTICLES} ${(seeded.bytes / 1024 ** 3).toFixed(2)} GiB\n`);
const browser = await chromium.launch();
let passed = true;
const rows: string[] = [];

try {
	const me = ((await directus('GET', '/users/me?fields=id')) as { data: { id: string } }).data.id;
	const contexts = {} as Record<App, BrowserContext>;
	for (const [app, base] of Object.entries(APPS) as [App, string][]) contexts[app] = await signIn(browser, base);

	// One unmeasured run per app: lazy chunks, schema and permission caches.
	for (const app of Object.keys(APPS) as App[]) await measure(app, contexts[app], me);
	for (const app of Object.keys(APPS) as App[])
		for (const action of Object.keys(ACTIONS) as Action[]) {
			timings[app][action] = [];
			requests[app][action] = [];
		}

	for (let i = 0; i < RUNS; i++) {
		for (const app of Object.keys(APPS) as App[]) await measure(app, contexts[app], me);
		process.stdout.write(`run ${i + 1}/${RUNS} done\n`);
	}

	for (const [action, target] of Object.entries(ACTIONS) as [Action, number | undefined][]) {
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
			`| ${action} | ${target ?? '-'} | ${cells.join(' | ')} | ${split} | ${reasons.length ? `FAIL: ${reasons.join('; ')}` : 'ok'} |`,
		);
	}
} finally {
	await browser.close();
	await directus('DELETE', '/presets', { query: { filter: { collection: { _eq: ARTICLES } } } }).catch(() => undefined);
	await cleanup(seeded);
}

const report = [
	`| Action | target (ms) | p95 ${Object.keys(APPS).join(' (ms) | p95 ')} (ms) | requests list + count (${Object.keys(APPS).join(' / ')}) | Result |`,
	'| --- | --- | --- | --- | --- | --- | --- |',
	...rows,
].join('\n');
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(
		process.env['GITHUB_STEP_SUMMARY'],
		`## Benchmark web content\n\nSeed: ${seeded.seconds} s, ${(seeded.bytes / 1024 ** 3).toFixed(2)} GiB; ${RUNS} runs, chromium.\n\n${report}\n`,
	);

process.exit(passed ? 0 : 1);
