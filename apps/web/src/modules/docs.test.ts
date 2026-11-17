// Spec 033 T012 (FR-001, FR-012, research R1).
import { expect, test } from 'vitest';
import docs from './docs.ts';

test('the documentation is a hidden module without a pre-register check', () => {
	expect(docs.id).toBe('docs');
	expect(docs.hidden).toBe(true);
	expect(docs.name).toBe('$t:documentation');
	expect(docs.icon).toBe('menu_book');
	expect(docs.preRegisterCheck).toBeUndefined();
});

test('two routes, the home and every page under it, on one lazy component', () => {
	expect(docs.routes.map((route) => route.path)).toEqual(['', ':path(.*)*']);
	expect(docs.routes[0]!.component).toBe(docs.routes[1]!.component);
	expect(typeof docs.routes[0]!.component).toBe('function');
});
