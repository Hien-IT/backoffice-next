// R12, FR-074 (T066): the entry chunk of the build, gzipped, stays within 350 KB. Fonts and lazy route chunks are
// not counted (FR-074 measures the main bundle).
// Usage: node scripts/check-bundle.mjs [distDir]
import { readFileSync } from 'node:fs';
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
// TinyMCE by its UI class: `tinymce` alone also names the option `tinymceOverrides` and its help links. FullCalendar by
// its CSS class, the split panel by its root class, json-to-graphql-query by its alias keyword.
export const LAZY_ONLY = [
	'maplibre-gl',
	'EditorJS',
	'CodeMirror',
	'tox-tinymce',
	'fc-scrollgrid',
	'sp-root',
	'__aliasFor',
];

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
	const limit = Math.min(LIMIT, BUDGET_014);

	process.stdout.write(`check-bundle: ${file} ${kb} KB gzip (limit ${(limit / 1024).toFixed(1)} KB)\n`);
	if (leaks.length) process.stdout.write(`check-bundle: lazy-only libraries in the entry chunk: ${leaks.join(', ')}\n`);
	process.exit(gzip <= limit && leaks.length === 0 ? 0 : 1);
}
