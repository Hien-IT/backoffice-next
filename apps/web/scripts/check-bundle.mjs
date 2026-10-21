// R12, FR-074 (T066): the main bundle of the build (entry chunk and its static imports), gzipped, stays within 350 KB. Fonts and lazy route chunks are
// not counted (FR-074 measures the main bundle).
// Usage: node scripts/check-bundle.mjs [distDir]
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const LIMIT = 350 * 1024;
// Feature 013 (research R12): the entry may grow at most 120 KB over 012's 132.4 KB, and the heavy editors and map
// libraries stay in their own lazy chunks.
export const BUDGET_013 = Math.round((132.4 + 120) * 1024);
// Feature 014 (SC-012, research R14): the entry may grow at most 60 KB over 013's 205.8 KB; the calendar, the split
// panel of the live preview and the GraphQL query builder of "save as copy" stay in lazy chunks.
export const BUDGET_014 = Math.round((205.8 + 60) * 1024);
// Feature 015 (research R10): at most 20 KB over the 014 budget; tus-js-client (resumable uploads) stays in a lazy chunk.
export const BUDGET_015 = BUDGET_014 + 20 * 1024;
// Feature 016 (FR-109, research R12): at most 20 KB over the 015 budget; the field drawer, the permissions matrix and the
// app permission data stay in lazy chunks.
export const BUDGET_016 = BUDGET_015 + 20 * 1024;
// Feature 017 (FR-109, research R12): at most 20 KB over the 016 budget; the flow canvas, the operations registry and the
// log drawer stay in lazy chunks.
export const BUDGET_017 = BUDGET_016 + 20 * 1024;
// Feature 018 (FR-109, research R12): at most 15 KB over the 017 budget; the Insights route, the panel registry,
// ApexCharts and the notifications drawer stay in lazy chunks.
export const BUDGET_018 = BUDGET_017 + 15 * 1024;
// Feature 020 (T116, research R4): at most 3 KB over the 018 budget (019 left the web app as it was) for the extension
// loader; the import map moves vue, vue-router, vue-i18n, pinia and @directus/extensions-sdk to their own entry chunks,
// so the main bundle is the module script of index.html and every chunk it imports statically.
export const BUDGET_020 = BUDGET_018 + 3 * 1024;
// TinyMCE by its UI class: `tinymce` alone also names the option `tinymceOverrides` and its help links. FullCalendar by
// its CSS class, the split panel by its root class, json-to-graphql-query by its alias keyword, tus-js-client by its
// protocol header, Cropper.js (image editor) by its container class.
export const LAZY_ONLY = [
	'maplibre-gl',
	'EditorJS',
	'CodeMirror',
	'tox-tinymce',
	'fc-scrollgrid',
	'sp-root',
	'__aliasFor',
	'Tus-Resumable',
	'cropper-container',
	'apexcharts-canvas',
	'VErrorBoundary',
];

// Feature 015 (T101, CHK088): the lazy chunks of the image editor, resumable uploads and the theme data stay small. Each
// is found by a marker of its library or data; the limit is gzip bytes.
export const LAZY_BUDGETS_015 = [
	{ name: 'cropperjs', marker: 'cropper-container', limit: 60 * 1024 },
	{ name: 'tus-js-client', marker: 'Tus-Resumable', limit: 25 * 1024 },
	{ name: 'theme data', marker: 'theme_directus_default', limit: 15 * 1024 },
];

// Feature 016 (FR-109, research R12): the field drawer (its Pinia store id), the permissions matrix (the
// `data-permissions-matrix` attribute of its table; i18n keys also sit in the language chunks) and the app permission
// data (its own chunk, named after app-permissions-data.json: the `$source` key is tree-shaken away). Not found until
// the wave that builds them.
export const LAZY_BUDGETS_016 = [
	{ name: 'field drawer', marker: 'fieldDetail', limit: 80 * 1024 },
	{ name: 'permissions matrix', marker: 'data-permissions-matrix', limit: 40 * 1024 },
	{ name: 'app permission data', file: 'app-permissions-data-', limit: 10 * 1024 },
];

// Feature 017 (FR-109): the flow canvas (the `data-flow-canvas` attribute of its scroller), the operations registry (the
// i18n key of the iteration mode note of the `trigger` operation) and the log drawer (`data-flow-log` of its list). Not
// found until the wave that builds them.
export const LAZY_BUDGETS_017 = [
	{ name: 'flow canvas', marker: 'data-flow-canvas', limit: 60 * 1024 },
	{ name: 'operations registry', marker: 'operations.trigger.iteration_mode_note', limit: 25 * 1024 },
	{ name: 'flow log drawer', marker: 'data-flow-log', limit: 15 * 1024 },
];

// Feature 018 (FR-109): the Insights route (`data-insights-route` of its pages), the panel registry (the i18n key of the
// time series name), ApexCharts (its canvas class; size measured at T050) and the notifications drawer
// (`data-notifications-drawer`). Not found until the wave that builds them.
export const LAZY_BUDGETS_018 = [
	{ name: 'insights route', marker: 'data-insights-route', limit: 60 * 1024 },
	{ name: 'panel registry', marker: 'panels.time_series.name', limit: 40 * 1024 },
	{ name: 'apexcharts', marker: 'apexcharts-canvas', limit: 170 * 1024 },
	{ name: 'notifications drawer', marker: 'data-notifications-drawer', limit: 15 * 1024 },
];

// Feature 020 (T116): the v-* shim (the `VErrorBoundary` name of its registry), loaded only when the API bundle has app
// extensions; the shim chunk alone, without the chunks it shares with the screens.
export const LAZY_BUDGETS_020 = [{ name: 'v-* shim', marker: 'VErrorBoundary', limit: 150 * 1024 }];

export const LAZY_BUDGETS = [
	...LAZY_BUDGETS_015,
	...LAZY_BUDGETS_016,
	...LAZY_BUDGETS_017,
	...LAZY_BUDGETS_018,
	...LAZY_BUDGETS_020,
];

/**
 * Gzipped size of the largest lazy chunk (not one of the main bundle) holding each budget's marker, or named with its
 * `file` prefix; null when none does.
 */
export function lazyChunkSizes(distDir, mainFiles) {
	const main = [mainFiles].flat();
	const assets = join(distDir, 'assets');
	const files = readdirSync(assets)
		.filter((name) => name.endsWith('.js'))
		.map((name) => join(assets, name))
		.filter((file) => !main.includes(file));

	return LAZY_BUDGETS.map((budget) => {
		const sizes = files
			.filter((file) =>
				budget.file ? basename(file).startsWith(budget.file) : readFileSync(file, 'utf8').includes(budget.marker),
			)
			.map((file) => gzipSync(readFileSync(file)).length);
		return { ...budget, gzip: sizes.length ? Math.max(...sizes) : null };
	});
}

/** Library markers found in the main bundle that must only be in lazy chunks. */
export function lazyLeaks(mainFiles) {
	const code = [mainFiles]
		.flat()
		.map((file) => readFileSync(file, 'utf8'))
		.join('\n');
	return LAZY_ONLY.filter((marker) => code.includes(marker));
}

/** The chunk and the chunks it imports statically (`import"./x.js"`, `from"./x.js"`; not `import("./x.js")`). */
export function staticClosure(file, seen = new Set()) {
	if (seen.has(file)) return [...seen];
	seen.add(file);
	for (const [, name] of readFileSync(file, 'utf8').matchAll(/(?:\bimport|\bfrom)\s*["']\.\/([^"']+\.js)["']/g)) {
		staticClosure(join(dirname(file), name), seen);
	}
	return [...seen];
}

/** Gzipped size of the module script index.html loads (`/admin/assets/index*.js`) and its static imports. */
export function entrySize(distDir) {
	const html = readFileSync(join(distDir, 'index.html'), 'utf8');
	const src = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1];
	if (!src) throw new Error('no module script in index.html');

	const file = join(distDir, src.replace(/^\/admin\//, ''));
	const files = staticClosure(file);
	return { file, files, gzip: files.reduce((sum, chunk) => sum + gzipSync(readFileSync(chunk)).length, 0) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const distDir = resolve(process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '../dist'));
	const { file, files, gzip } = entrySize(distDir);
	const kb = (gzip / 1024).toFixed(1);

	const leaks = lazyLeaks(files);
	const limit = Math.min(LIMIT, BUDGET_020);

	process.stdout.write(
		`check-bundle: ${file} and ${files.length - 1} static imports ${kb} KB gzip (limit ${(limit / 1024).toFixed(1)} KB)\n`,
	);
	if (leaks.length) process.stdout.write(`check-bundle: lazy-only libraries in the entry chunk: ${leaks.join(', ')}\n`);

	const lazy = lazyChunkSizes(distDir, files);
	for (const chunk of lazy) {
		const size = chunk.gzip === null ? 'not found' : `${(chunk.gzip / 1024).toFixed(1)} KB gzip`;
		process.stdout.write(`check-bundle: lazy ${chunk.name} ${size} (limit ${(chunk.limit / 1024).toFixed(1)} KB)\n`);
	}
	const lazyOver = lazy.filter((chunk) => chunk.gzip !== null && chunk.gzip > chunk.limit);

	process.exit(gzip <= limit && leaks.length === 0 && lazyOver.length === 0 ? 0 : 1);
}
