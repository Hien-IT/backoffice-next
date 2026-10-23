// DR has no test for the translations display (spec FR-072, FR-073, FR-074 `translations`): the item picked by
// userLanguage / defaultLanguage / first, the template, the info menu trigger, `fields`, `options` and `handler` on the
// fixture bo_translations.
import { readItem } from '@directus/sdk';
import type { ExtensionOptionsContext } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import DisplayTranslations from './DisplayTranslations.vue';
import display from './index.ts';

const fieldsFn = display.fields as (
	options: Record<string, unknown> | null,
	context: Record<string, string>,
) => string[];

const snapshot = loadSnapshot();
const fixtureOptions = fieldsOf('bo_translations').find((f) => f.field === 'translations')!.meta!.display_options!;
let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	i18n.global.locale.value = 'en-US';
});

/** `translations` of a bo_translations row read with the display fields (languages expanded). */
async function translationsOf(id: number): Promise<Record<string, any>[]> {
	const fields = adjustFieldsForDisplays(['translations'], 'bo_translations');
	const item = (await sdk.request(readItem('bo_translations' as never, id, { fields } as never))) as Record<
		string,
		any
	>;
	return item['translations'];
}

function mountDisplay(props: Record<string, unknown>) {
	return mount(DisplayTranslations, {
		props: { collection: 'bo_translations', field: 'translations', type: 'alias', ...props } as never,
		global: { plugins: [i18n] },
	});
}

const shown = (wrapper: ReturnType<typeof mount>) => wrapper.get('.display-translations > div').text().trim();

describe('picked translation', () => {
	test('fixture field: "Hello" and an info menu trigger', async () => {
		const wrapper = mountDisplay({ value: await translationsOf(1), ...fixtureOptions });
		const trigger = wrapper.get('button');

		expect(shown(wrapper)).toBe('Hello');
		expect(trigger.attributes('aria-label')).toBe('Translations');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('disabled')).toBeUndefined();
	});

	test('option:translations.defaultLanguage picks that language', async () => {
		const value = await translationsOf(1);

		expect(shown(mountDisplay({ value, template: '{{ title }}', defaultLanguage: 'vi-VN' }))).toBe('Xin chào');
		expect(shown(mountDisplay({ value, template: '{{ title }}', defaultLanguage: 'en-US' }))).toBe('Hello');
	});

	test('without a default language match the first translation is shown', async () => {
		expect(shown(mountDisplay({ value: await translationsOf(1), template: '{{ title }}' }))).toBe('Hello');
		expect(shown(mountDisplay({ value: await translationsOf(2), ...fixtureOptions }))).toBe('مرحبا');
	});

	test('option:translations.userLanguage prefers the language of the current user', async () => {
		const value = await translationsOf(1);
		const userStore = useUserStore();

		// No user: the language falls back to en-US.
		expect(shown(mountDisplay({ value, template: '{{ title }}', userLanguage: true, defaultLanguage: 'vi-VN' }))).toBe(
			'Hello',
		);

		userStore.currentUser = { ...snapshot.users.admin.me, language: 'vi-VN' } as never;
		await flushPromises();

		expect(shown(mountDisplay({ value, template: '{{ title }}', userLanguage: true, defaultLanguage: 'en-US' }))).toBe(
			'Xin chào',
		);
		// userLanguage off: the default language wins.
		expect(shown(mountDisplay({ value, template: '{{ title }}', defaultLanguage: 'en-US' }))).toBe('Hello');
	});

	test('option:translations.template renders the junction row; without it the primary key', async () => {
		const value = await translationsOf(1);

		expect(shown(mountDisplay({ value, template: '{{ body }}' }))).toBe('Hello body');
		expect(shown(mountDisplay({ value, template: '{{ title }} / {{ body }}' }))).toBe('Hello / Hello body');
		// bo_translations_translations has no display template.
		expect(shown(mountDisplay({ value }))).toBe('1');
	});

	test('no translations disables the menu trigger; a field without relation shows ValueNull', () => {
		const empty = mountDisplay({ value: [], ...fixtureOptions });

		expect(empty.get('button').attributes('disabled')).toBeDefined();
		expect(mountDisplay({ field: 'slug', value: [] }).get('.sr-only').text()).toBe('No value');
	});
});

describe('index', () => {
	const context = () => ({
		collection: 'bo_translations',
		field: useFieldsStore().getField('bo_translations', 'translations')!,
	});

	test('handler(): the user language (i18n locale), else the default language, else the first item', async () => {
		const value = await translationsOf(1);

		expect(display.handler!(value, fixtureOptions, context())).toBe('Hello');
		i18n.global.locale.value = 'vi-VN';
		expect(display.handler!(value, fixtureOptions, context())).toBe('Xin chào');
		expect(display.handler!(value, { ...fixtureOptions, userLanguage: false }, context())).toBe('Hello');
		expect(display.handler!(value, { template: '{{ body }}', defaultLanguage: 'vi-VN' }, context())).toBe('Nội dung');
		expect(display.handler!(await translationsOf(2), fixtureOptions, context())).toBe('مرحبا');
	});

	test('handler(): anything but an array, or no field, comes back unchanged', () => {
		expect(display.handler!('x', fixtureOptions, context())).toBe('x');
		expect(display.handler!([{ id: 1 }], fixtureOptions, {})).toEqual([{ id: 1 }]);
	});

	test('fields(): every field, the template fields and the language key (plus the language field)', () => {
		const ctx = { collection: 'bo_translations', field: 'translations', type: 'alias' };

		expect(fieldsFn(fixtureOptions, ctx)).toEqual(['*', 'title', 'bo_languages_code.code', 'bo_languages_code.name']);
		expect(fieldsFn(null, ctx)).toEqual(['*', 'bo_languages_code.code']);
		expect(fieldsFn(null, { ...ctx, field: 'slug' })).toEqual([]);
	});

	test('options(): template on the junction, language field choices from the languages collection', () => {
		const optionsFn = display.options as (context: ExtensionOptionsContext) => any[];
		const options = optionsFn({
			relations: { o2m: { collection: 'bo_translations_translations' }, m2o: { related_collection: 'bo_languages' } },
		} as never);

		expect(options.map((option) => option.field)).toEqual([
			'template',
			'languageField',
			'defaultLanguage',
			'userLanguage',
		]);
		expect(options[0].meta.options).toEqual({ collectionName: 'bo_translations_translations' });
		expect(options[1].meta.options.choices).toEqual([
			{ text: 'Code', value: 'code' },
			{ text: 'Name', value: 'name' },
			{ text: 'Direction', value: 'direction' },
		]);
		expect(options[3].schema).toEqual({ default_value: false });
		expect(optionsFn({ relations: {} } as never)[1].meta.options.choices).toEqual([]);
	});
});
