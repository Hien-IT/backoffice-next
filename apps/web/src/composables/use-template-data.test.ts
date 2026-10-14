import type { Collection } from '@directus/types';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { useTemplateData } from './use-template-data.ts';

vi.mock('../utils/adjust-fields-for-displays.ts', () => ({
	adjustFieldsForDisplays: (fields: string[]) => fields.map((field) => (field === 'author' ? 'author.name' : field)),
}));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

const articles = { collection: 'articles', meta: { display_template: '{{ title }} by {{ author }}' } } as Collection;

test('reads the template fields of the item and merges injected data', async () => {
	const fetch = mockApi({ 'GET /items/articles/a%2F1': { title: 'Hi', author: { name: 'Ann' } } });

	const { template, templateData, loading } = useTemplateData(ref(articles), ref('a/1'), {
		injectData: ref({ title: 'Local' }),
	});

	await flushPromises();

	expect(template.value).toBe('{{ title }} by {{ author }}');
	expect(calls(fetch)).toEqual(['GET /items/articles/a/1?fields=author.name']);
	expect(templateData.value).toEqual({ title: 'Local', author: { name: 'Ann' } });
	expect(loading.value).toBe(false);
});

test('reads a singleton of a system collection and uses the template option', async () => {
	const fetch = mockApi({ 'GET /settings': { project_name: 'P' } });

	const { templateData } = useTemplateData(
		ref({ collection: 'directus_settings', meta: { singleton: true } } as Collection),
		ref(null),
		{ template: ref('{{ project_name }}') },
	);

	await flushPromises();

	expect(calls(fetch)).toEqual(['GET /settings?fields=project_name']);
	expect(templateData.value).toEqual({ project_name: 'P' });
});

test('no request for a new item, without template or when every field is injected', async () => {
	const fetch = mockApi({});

	expect(useTemplateData(ref(articles), ref('+')).templateData.value).toBeNull();
	expect(useTemplateData(ref({ collection: 'x', meta: null } as Collection), ref(1)).templateData.value).toBeNull();

	const injected = useTemplateData(ref(articles), ref(1), { injectData: ref({ title: 'a', author: 'b' }) });
	expect(injected.templateData.value).toEqual({ title: 'a', author: 'b' });

	await flushPromises();
	expect(calls(fetch)).toEqual([]);
});

test('keeps the request error', async () => {
	mockApi({ 'GET /items/articles/1': () => json({ errors: [{ message: 'Forbidden' }] }, 403) });

	const { error, templateData } = useTemplateData(ref(articles), ref(1));

	await flushPromises();

	expect(error.value.message).toBe('Forbidden');
	expect(templateData.value).toBeNull();
});
