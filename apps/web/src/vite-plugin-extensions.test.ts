// Spec 020 (T141, contracts/web.md §2): the import map of the shared dependencies goes before the first module script
// or modulepreload, so the browser knows it before any module import.
import { expect, test } from 'vitest';
import { APP_SHARED_DEPS, insertImportMap } from '../vite-plugin-extensions.ts';

test('the five shared dependencies of Directus 11.17.4', () => {
	expect(APP_SHARED_DEPS).toEqual(['vue', 'vue-router', 'vue-i18n', 'pinia', '@directus/extensions-sdk']);
});

test('inserted before the first modulepreload or module script', () => {
	const html =
		'<head><link rel="modulepreload" href="/admin/assets/a.js"><script type="module" src="/admin/assets/index.js"></script></head>';
	const out = insertImportMap(html, { vue: '/admin/assets/vue.1.entry.js' });

	expect(out.indexOf('type="importmap"')).toBeLessThan(out.indexOf('modulepreload'));
	expect(out).toContain('{"imports":{"vue":"/admin/assets/vue.1.entry.js"}}');
});

test('without a module script the map closes the head', () => {
	expect(insertImportMap('<head></head>', { vue: '/v.js' })).toBe(
		'<head><script type="importmap">{"imports":{"vue":"/v.js"}}</script>\n</head>',
	);
});
