// Spec 020 (FR-096, SC-006, T149): the first open of an app page that uses an app extension, with the fixture extension
// set loaded (PARITY_EXTENSIONS_ENV=extensions: the benchmark workflow recreates the API services with it after the other
// web benchmarks, which measure without extensions, SC-005). Seed: a collection `bench-ext-<hex>` with one item whose
// field uses the display parity-display-badge, deleted in a `finally`. Playwright chromium signs in to the Directus app
// (8155/admin) and to the Backoffice web app behind a proxy to Directus (8171) and to the new API (8172); each run opens
// a new page at /admin/content/<collection> and stops when the badge the display extension draws is visible (the app
// loaded /extensions/sources/index.js, registered the extension and rendered the table). BENCH_RUNS runs (11) after one
// unmeasured run, nearest-rank p95. Fails when a web app's p95 is more than TOLERANCE and WEB_FLOOR_MS above the Directus
// app's. Needs `benchmark:env-up-web` with the extensions env first.
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { type BrowserContext, chromium } from '@playwright/test';
import { webSlower } from './compare.ts';
import { directus } from './seed-permissions.ts';
import { p95, signIn, TIMEOUT } from './web-shared.ts';

const RUNS = Number(process.env['BENCH_RUNS'] ?? 11);
const APPS = {
	'Directus app': process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155',
	'web → Directus': process.env['WEB_DIRECTUS_URL'] ?? 'http://127.0.0.1:8171',
	'web → API': process.env['WEB_API_URL'] ?? 'http://127.0.0.1:8172',
};
type App = keyof typeof APPS;

const collection = `bench_ext_${randomBytes(3).toString('hex')}`;
const timings = Object.fromEntries(Object.keys(APPS).map((app) => [app, [] as number[]])) as Record<App, number[]>;

async function open(context: BrowserContext): Promise<number> {
	const page = await context.newPage();
	const start = performance.now();
	await page.goto(`/admin/content/${collection}`);
	await page.locator('[data-testid="parity-badge"]').first().waitFor({ timeout: TIMEOUT });
	const time = performance.now() - start;
	await page.close();
	return time;
}

await directus('POST', '/collections', {
	collection,
	schema: {},
	meta: {},
	fields: [
		{
			field: 'id',
			type: 'integer',
			schema: { is_primary_key: true, has_auto_increment: true },
			meta: { hidden: true },
		},
		{ field: 'color', type: 'string', meta: { interface: 'input', display: 'parity-display-badge' } },
	],
});
await directus('POST', `/items/${collection}`, { color: 'red' });

const browser = await chromium.launch();
let passed = true;
let row = '';

try {
	const contexts = {} as Record<App, BrowserContext>;
	for (const [app, base] of Object.entries(APPS) as [App, string][]) contexts[app] = await signIn(browser, base);

	// One unmeasured open per app: the HTTP cache of the app files, the extension bundle build of each API.
	for (const app of Object.keys(APPS) as App[]) await open(contexts[app]);

	for (let i = 0; i < RUNS; i++) {
		for (const app of Object.keys(APPS) as App[]) timings[app].push(await open(contexts[app]));
		process.stdout.write(`run ${i + 1}/${RUNS} done\n`);
	}

	const reference = p95(timings['Directus app']);
	const reasons = (['web → Directus', 'web → API'] as const)
		.map((app) => webSlower(app, p95(timings[app]), reference))
		.filter((reason): reason is string => reason !== undefined);
	passed = reasons.length === 0;
	const cells = (Object.keys(APPS) as App[]).map((app) => p95(timings[app]));
	row = `| first open with app extensions | ${cells.join(' | ')} | ${passed ? 'ok' : `FAIL: ${reasons.join('; ')}`} |`;
} finally {
	await browser.close();
	await directus('DELETE', `/collections/${collection}`).catch(() => undefined);
}

const report = [
	`| Action | p95 ${Object.keys(APPS).join(' (ms) | p95 ')} (ms) | Result |`,
	'| --- | --- | --- | --- | --- |',
	row,
].join('\n');
process.stdout.write(`${report}\n`);
if (process.env['GITHUB_STEP_SUMMARY'])
	appendFileSync(
		process.env['GITHUB_STEP_SUMMARY'],
		`## Benchmark web extensions (SC-006)\n\n${RUNS} runs, chromium, fixture extension set.\n\n${report}\n`,
	);

process.exit(passed ? 0 : 1);
