// Feature 016 (T042, FR-028): system-collections-translations, as Directus system-collections-translations.vue and its
// dialog: hidden for system collections, the enable mode with the Directus defaults, the manage mode, the two bodies
// of POST /utils/translations/generate and the store reloads.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../../../api/sdk.ts';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { calls, mockApi } from '../../../test-utils/fetch.ts';
import config from './index.ts';
import SystemCollectionsTranslations from './SystemCollectionsTranslations.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

const field = (collection: string, name: string, type = 'string', extra: Record<string, any> = {}) => ({
	collection,
	field: name,
	name,
	type,
	schema: extra['schema'] ?? {},
	meta: { id: 1, sort: null, special: null, system: false, ...extra['meta'] },
});

const ARTICLE_FIELDS = [
	field('articles', 'id', 'integer', { schema: { is_primary_key: true, has_auto_increment: true } }),
	field('articles', 'title'),
	field('articles', 'body', 'text'),
	field('articles', 'date_created', 'timestamp', { meta: { special: ['date-created'] } }),
];

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	const collections = useCollectionsStore();
	collections.collections = [
		collections.prepareCollectionForApp({ collection: 'articles', schema: {}, meta: {} } as never),
	];
	useFieldsStore().fields = ARTICLE_FIELDS as never;
});

const mountHelper = (collection: string | null) =>
	mount(SystemCollectionsTranslations, {
		props: { value: null },
		global: { plugins: [pinia, i18n], provide: { values: ref({ collection }) } },
		attachTo: document.body,
	});

const button = (text: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text)!;

const posted = (fetch: ReturnType<typeof mockApi>) =>
	fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init!.body)));

test('is registered with the Directus config', () => {
	expect(config).toMatchObject({
		id: 'system-collections-translations',
		name: '$t:enable_translations',
		types: ['alias'],
		hideLabel: true,
		system: true,
	});
});

test('nothing for a system collection or without a collection', () => {
	expect(mountHelper('directus_users').html()).toBe('<!--v-if-->');
	expect(mountHelper(null).html()).toBe('<!--v-if-->');
});

test('enable: the eligible fields preselected, the Directus defaults, then the store reloads', async () => {
	const fetch = mockApi({
		'POST /utils/translations/generate': {},
		'GET /collections': [],
		'GET /fields': [],
		'GET /relations': [],
	});
	mountHelper('articles');

	expect(document.body.textContent).toContain(t('translations_enable_helper_description'));
	button(t('enable_translations')).click();
	await flushPromises();

	// The languages collection does not exist yet: it is created and seeded; the parent key is `<collection>_<pk>`.
	expect(document.body.textContent).toContain('articles_translations.articles_id');
	button(t('enable')).click();
	await flushPromises();

	expect(posted(fetch)).toEqual([
		{
			collection: 'articles',
			fields: ['title', 'body'],
			translationsCollection: 'articles_translations',
			languagesCollection: 'languages',
			parentFkField: 'articles_id',
			languageFkField: 'languages_code',
			createLanguagesCollection: true,
			seedLanguages: true,
		},
	]);
	expect(
		calls(fetch)
			.filter((c) => c.startsWith('GET'))
			.sort(),
	).toEqual(['GET /collections', 'GET /fields', 'GET /relations']);
});

test('manage: an existing configuration adds the missing fields only', async () => {
	useFieldsStore().fields = [
		...ARTICLE_FIELDS,
		field('articles', 'translations', 'alias', { meta: { special: ['translations'] } }),
		field('articles_translations', 'id', 'integer', { schema: { is_primary_key: true } }),
		field('articles_translations', 'articles_id', 'integer'),
		field('articles_translations', 'languages_code', 'string'),
		field('articles_translations', 'title'),
		field('languages', 'code', 'string', { schema: { is_primary_key: true } }),
	] as never;
	useRelationsStore().relations = [
		{
			collection: 'articles_translations',
			field: 'articles_id',
			related_collection: 'articles',
			schema: null,
			meta: {
				one_field: 'translations',
				one_collection: 'articles',
				many_collection: 'articles_translations',
				junction_field: 'languages_code',
			},
		},
		{
			collection: 'articles_translations',
			field: 'languages_code',
			related_collection: 'languages',
			schema: null,
			meta: {
				one_field: null,
				one_collection: 'languages',
				many_collection: 'articles_translations',
				junction_field: 'articles_id',
			},
		},
	] as never;
	const fetch = mockApi({
		'POST /utils/translations/generate': {},
		'GET /collections': [],
		'GET /fields': [],
		'GET /relations': [],
	});
	mountHelper('articles');

	expect(document.body.textContent).toContain(t('translations_already_enabled'));
	button(t('add_fields')).click();
	await flushPromises();
	button(t('save')).click();
	await flushPromises();

	expect(posted(fetch)).toEqual([
		{ collection: 'articles', translationsCollection: 'articles_translations', fields: ['body'] },
	]);
});
