// Spec 020 (research R4, contracts/web.md §2, FR-062): the shared dependencies app extensions import as bare
// specifiers (`vue`, `vue-router`, `vue-i18n`, `pinia`, `@directus/extensions-sdk`) resolve, through an import map in
// index.html, to the very modules the app runs, like the `directus-extensions-build` plugin of directus/app/vite.config.js.
// Build: each dependency is an entry `assets/<name>.<hash>.entry.js` with its exports kept, and the import map is
// written into index.html before the first module script. Dev: the map points to one virtual module per dependency,
// `export * from '<dep>'`, which Vite rewrites to the optimized dependency URL the app imports (a bare `/@id/<dep>` has
// no `?v=` hash: Vite answers 504 "Outdated Optimize Dep", or serves a second copy of the module).
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export const APP_SHARED_DEPS = ['vue', 'vue-router', 'vue-i18n', 'pinia', '@directus/extensions-sdk'] as const;

/**
 * The entry chunk name of a shared dependency: its npm scope dropped (owner 2026-10-24, D-177: no "@directus" in the
 * file names), so `@directus/extensions-sdk` is `assets/extensions-sdk.<hash>.entry.js`. The import map keys stay the
 * bare specifiers the extensions import.
 */
export const entryName = (dep: string) => dep.replace(/^@[^/]+\//, '').replace(/\//g, '_');

const SHARED_PREFIX = 'bo-shared:';

const importMapContent = (imports: Record<string, string>) => JSON.stringify({ imports });

/** Base64 sha256 of the import map script content, the `'sha256-…'` source the CSP of the web image allows. */
export const importMapHash = (imports: Record<string, string>) =>
	createHash('sha256').update(importMapContent(imports)).digest('base64');

/** `<script type="importmap">` for `imports`, inserted before the first module script or modulepreload of `html`. */
export function insertImportMap(html: string, imports: Record<string, string>): string {
	const tag = `<script type="importmap">${importMapContent(imports)}</script>`;
	const first = /<script type="module"|<link rel="modulepreload"/.exec(html);
	return first
		? `${html.slice(0, first.index)}${tag}\n\t\t${html.slice(first.index)}`
		: html.replace('</head>', `${tag}\n</head>`);
}

export function backofficeExtensions(indexHtml: string): Plugin[] {
	let base = '/';

	return [
		{
			name: 'backoffice-extensions-build',
			apply: 'build',
			config: () => ({
				build: {
					rollupOptions: {
						input: {
							index: indexHtml,
							...Object.fromEntries(APP_SHARED_DEPS.map((dep) => [entryName(dep), dep])),
						},
						output: { entryFileNames: 'assets/[name].[hash].entry.js' },
						preserveEntrySignatures: 'exports-only',
					},
				},
			}),
			configResolved(config) {
				base = config.base;
			},
			generateBundle: {
				order: 'post',
				handler(_options, bundle) {
					const imports: Record<string, string> = {};

					for (const dep of APP_SHARED_DEPS) {
						const chunk = Object.values(bundle).find(
							(output) => output.type === 'chunk' && output.isEntry && output.name === entryName(dep),
						);

						if (!chunk) this.error(`no entry chunk for the shared dependency ${dep}`);
						imports[dep] = `${base}${chunk!.fileName}`;
					}

					const html = bundle['index.html'];
					if (html?.type !== 'asset') this.error('index.html is missing from the bundle');
					html!.source = insertImportMap(String(html!.source), imports);
					// Read by docker/40-config.sh: the inline script is allowed by its hash, not 'unsafe-inline'.
					this.emitFile({ type: 'asset', fileName: 'importmap.sha256', source: `${importMapHash(imports)}\n` });
				},
			},
		},
		{
			name: 'backoffice-extensions-serve',
			apply: 'serve',
			configResolved(config) {
				base = config.base;
			},
			resolveId: (id) => (id.startsWith(SHARED_PREFIX) ? `\0${id}` : undefined),
			load: (id) =>
				id.startsWith(`\0${SHARED_PREFIX}`) ? `export * from '${id.slice(SHARED_PREFIX.length + 1)}';` : undefined,
			transformIndexHtml: {
				order: 'pre',
				handler: (html) =>
					insertImportMap(
						html,
						Object.fromEntries(APP_SHARED_DEPS.map((dep) => [dep, `${base}@id/__x00__${SHARED_PREFIX}${dep}`])),
					),
			},
		},
	];
}
