// R12, FR-074 (T066): the entry chunk of the build, gzipped, stays within 350 KB. Fonts and lazy route chunks are
// not counted (FR-074 measures the main bundle).
// Usage: node scripts/check-bundle.mjs [distDir]
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const LIMIT = 350 * 1024;

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

	process.stdout.write(`check-bundle: ${file} ${kb} KB gzip (limit ${LIMIT / 1024} KB)\n`);
	process.exit(gzip <= LIMIT ? 0 : 1);
}
