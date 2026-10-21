// Spec 020 (T102): the committed contract of the Directus global components is what the script extracts from directus/
// today (a Directus upgrade or a hand edit fails here), and the extraction reads types, v-bind slot props and indexes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { OUT, extract, render } from './extract-directus-components.mjs';

test('fixtures/directus-components.json is up to date', () => {
	expect(render()).toBe(readFileSync(OUT, 'utf8'));
});

test('77 components, 3 views, 7 directives; props, slot props and expose read', () => {
	const contract = extract();

	expect(Object.keys(contract.components)).toHaveLength(77);
	expect(Object.keys(contract.views)).toEqual(['PrivateView', 'PublicView', 'SharedView']);
	expect(Object.keys(contract.directives)).toHaveLength(7);
	expect(contract.components.VButton.props.kind).toEqual({ type: 'String', required: false, default: "'normal'" });
	expect(contract.components.VMenu.slots.activator).toEqual(['activate', 'active', 'deactivate', 'toggle']);
	expect(contract.components.VMenu.expose).toEqual(['activate', 'activator', 'deactivate', 'id']);
	expect(Object.keys(contract.views.PrivateView.slots)).toContain('title-outer:prepend');
});
