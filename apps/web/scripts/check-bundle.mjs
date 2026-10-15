// R12, FR-074 (T066): the entry chunk of the build, gzipped, stays within 350 KB. Fonts and lazy route chunks are
// not counted (FR-074 measures the main bundle).
// Usage: node scripts/check-bundle.mjs [distDir]
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
];

// Feature 015 (T101, CHK088): the lazy chunks of the image editor, resumable uploads and the theme data stay small. Each
// is found by a marker of its library or data; the limit is gzip bytes.
export const LAZY_BUDGETS_015 = [
	{ name: 'cropperjs', marker: 'cropper-container', limit: 60 * 1024 },
	{ name: 'tus-js-client', marker: 'Tus-Resumable', limit: 25 * 1024 },
	{ name: 'theme data', marker: '$generated', limit: 15 * 1024 },
];

/** Gzipped size of the largest lazy chunk (not the entry) holding each budget's marker; null when none holds it. */
export function lazyChunkSizes(distDir, entryFile) {
	const assets = join(distDir, 'assets');
	const files = readdirSync(assets)
		.filter((name) => name.endsWith('.js'))
		.map((name) => join(assets, name))
		.filter((file) => file !== entryFile);

	return LAZY_BUDGETS_015.map((budget) => {
		const sizes = files
			.filter((file) => readFileSync(file, 'utf8').includes(budget.marker))
			.map((file) => gzipSync(readFileSync(file)).length);
		return { ...budget, gzip: sizes.length ? Math.max(...sizes) : null };
	});
}

/** Library markers found in the entry chunk that must only be in lazy chunks. */
export function lazyLeaks(file) {
	const code = readFileSync(file, 'utf8');
	return LAZY_ONLY.filter((marker) => code.includes(marker));
}

/** Gzipped size of the module script index.html loads (`/admin/assets/index-*.js`). */
export function entrySize(distDir) {
	const html = readFileSync(join(distDir, 'index.html'), 'utf8');
	const src = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1];
	if (!src) throw new Error('no module script in index.html');

	const file = join(distDir, src.replace(/^\/admin\//, ''));
	return { file, gzip: gzipSync(readFileSync(file)).length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const distDir = resolve(process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '../dist'));
	const { file, gzip } = entrySize(distDir);
	const kb = (gzip / 1024).toFixed(1);

	const leaks = lazyLeaks(file);
	const limit = Math.min(LIMIT, BUDGET_015);

	process.stdout.write(`check-bundle: ${file} ${kb} KB gzip (limit ${(limit / 1024).toFixed(1)} KB)\n`);
	if (leaks.length) process.stdout.write(`check-bundle: lazy-only libraries in the entry chunk: ${leaks.join(', ')}\n`);

	const lazy = lazyChunkSizes(distDir, file);
	for (const chunk of lazy) {
		const size = chunk.gzip === null ? 'not found' : `${(chunk.gzip / 1024).toFixed(1)} KB gzip`;
		process.stdout.write(`check-bundle: lazy ${chunk.name} ${size} (limit ${(chunk.limit / 1024).toFixed(1)} KB)\n`);
	}
	const lazyOver = lazy.filter((chunk) => chunk.gzip !== null && chunk.gzip > chunk.limit);

	process.exit(gzip <= limit && leaks.length === 0 && lazyOver.length === 0 ? 0 : 1);
}
