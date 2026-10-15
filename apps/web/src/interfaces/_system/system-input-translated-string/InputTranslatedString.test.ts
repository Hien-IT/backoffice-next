// Directus has no test for system-input-translated-string: behaviour of input-translated-string.vue (keys from
// /translations grouped by key, `$t:` value shown as a chip, search from 25 keys, new translation through the drawer and
// translationsStore.create).
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { i18n } from '../../../lang/index.ts';
import { useTranslationsStore } from '../../../stores/translations.ts';
import { useUserStore } from '../../../stores/user.ts';
import { fetchAll } from '../../../utils/fetch-all.ts';
import config from './index.ts';
import InputTranslatedString from './InputTranslatedString.vue';

vi.mock('../../../utils/fetch-all.ts', () => ({ fetchAll: vi.fn() }));

vi.mock('../../../components/drawers/DrawerItem.vue', () => ({
	default: defineComponent({
		name: 'DrawerItem',
		props: {
			active: Boolean,
			collection: { type: String, default: '' },
			primaryKey: { type: [String, Number], default: null },
			edits: { type: Object, default: null },
		},
		emits: ['update:active', 'input'],
		render: () => null,
	}),
}));

enableAutoUnmount(afterEach);

const fetchAllMock = vi.mocked(fetchAll);

beforeEach(() => {
	setActivePinia(createPinia());
	useUserStore().currentUser = { id: 'me', language: 'en-US' } as never;
	fetchAllMock.mockReset();
});

// The parent writes the emitted value back (v-model of a form), as Directus' setValue relies on the props watcher.
async function setup(props: Record<string, unknown> = {}, keys = ['greeting', 'farewell']) {
	fetchAllMock.mockResolvedValue(keys.map((key) => ({ key })));
	const wrapper: VueWrapper = mount(InputTranslatedString, {
		props: { ...props, onInput: (value: string | null) => wrapper.setProps({ value }) },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof setup>>;

async function openMenu(wrapper: Wrapper) {
	await wrapper.get('button[aria-label="Translations"]').trigger('click');
	await flushPromises();
	return document.body.querySelector<HTMLElement>('[role="dialog"]')!;
}

const keyButtons = (menu: HTMLElement) => [
	...menu.querySelectorAll<HTMLElement>('.translation-key > button:first-child'),
];

describe('system-input-translated-string', () => {
	test('is registered with the Directus config', () => {
		expect(config).toMatchObject({
			id: 'system-input-translated-string',
			system: true,
			types: ['string', 'text'],
			icon: 'translate',
		});
		expect(config.component).toBe(InputTranslatedString);
	});

	test('fetches the keys grouped by key and emits the typed text, null when emptied', async () => {
		const wrapper = await setup({ value: null, placeholder: 'Bookmark name...' });

		expect(fetchAllMock).toHaveBeenCalledWith('/translations', { params: { fields: ['key'], groupBy: ['key'] } });

		const input = wrapper.get('input');
		expect(input.attributes('placeholder')).toBe('Bookmark name...');
		await input.setValue('My bookmark');
		await input.setValue('');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([['My bookmark'], [null]]);
	});

	test('a $t: value shows the key as a chip; clicking it clears the value', async () => {
		const wrapper = await setup({ value: '$t:greeting' });

		expect(wrapper.find('input').exists()).toBe(false);
		const chip = wrapper.get('.selected-translation');
		expect(chip.text()).toBe('greeting');

		await chip.trigger('click');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[null]]);
		expect(wrapper.find('input').exists()).toBe(true);
	});

	test('the menu lists the keys; choosing one sets $t:<key> and marks it selected', async () => {
		const wrapper = await setup({ value: 'plain' });
		const menu = await openMenu(wrapper);

		expect(keyButtons(menu).map((button) => button.querySelector('.truncate')?.textContent?.trim())).toEqual([
			'greeting',
			'farewell',
		]);
		// No search below 25 keys.
		expect(menu.querySelector('input[type="search"]')).toBeNull();

		keyButtons(menu)[1]!.click();
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([['$t:farewell']]);
		expect(document.body.querySelector('[role="dialog"]')).toBeNull();

		await wrapper.setProps({ value: '$t:farewell' });
		const reopened = await openMenu(wrapper);
		expect(keyButtons(reopened)[1]!.getAttribute('aria-pressed')).toBe('true');
	});

	test('spaces in a $t: value become underscores', async () => {
		const wrapper = await setup({ value: null });
		await wrapper.get('input').setValue('$t:my key');
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([['$t:my key'], ['$t:my_key']]);
	});

	test('from 25 keys a search filters the list (100 at most) and highlights the match', async () => {
		const keys = Array.from({ length: 120 }, (_, index) => `key_${index}`);
		const wrapper = await setup({ value: null }, keys);
		const menu = await openMenu(wrapper);

		expect(keyButtons(menu)).toHaveLength(100);

		const search = menu.querySelector<HTMLInputElement>('input[type="search"]')!;
		search.value = '_11';
		search.dispatchEvent(new Event('input'));
		await flushPromises();

		expect(keyButtons(menu).map((button) => button.querySelector('.truncate')?.textContent?.trim())).toEqual([
			'key_11',
			...Array.from({ length: 10 }, (_, index) => `key_11${index}`),
		]);
		expect(keyButtons(menu)[0]!.querySelector('mark')?.textContent).toBe('_11');
	});

	test('a new custom translation opens the drawer with defaults and is created through the store', async () => {
		const wrapper = await setup({ value: 'Hello World' });
		const create = vi.spyOn(useTranslationsStore(), 'create').mockResolvedValue();
		const menu = await openMenu(wrapper);

		[...menu.querySelectorAll('button')]
			.find((button) => button.textContent?.includes('New Custom Translation'))!
			.click();
		await flushPromises();

		const drawer = wrapper.findComponent({ name: 'DrawerItem' });
		expect(drawer.props()).toMatchObject({
			active: true,
			collection: 'directus_translations',
			primaryKey: '+',
			edits: { language: 'en-US', key: 'hello_world', value: 'Hello World' },
		});

		fetchAllMock.mockResolvedValue([{ key: 'greeting' }, { key: 'hello_world' }]);
		const item = { language: 'vi-VN', key: 'hello_world', value: 'Xin chào' };
		drawer.vm.$emit('input', item);
		await flushPromises();

		expect(create).toHaveBeenCalledWith(item);
		expect(fetchAllMock).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted('input')).toEqual([['$t:hello_world']]);
	});

	test('the info button of a key lists its values per language', async () => {
		const wrapper = await setup({ value: null });
		const menu = await openMenu(wrapper);

		fetchAllMock.mockResolvedValue([
			{ language: 'en-US', key: 'greeting', value: 'Hello' },
			{ language: 'vi-VN', key: 'greeting', value: null },
		]);
		menu.querySelector<HTMLElement>('button[aria-label="Translations: greeting"]')!.click();
		await flushPromises();

		expect(fetchAllMock).toHaveBeenLastCalledWith('/translations', {
			params: { fields: ['language', 'key', 'value'], sort: ['language'], filter: { key: { _eq: 'greeting' } } },
		});
		const button = menu.querySelector('button[aria-label="Translations: greeting"]')!;
		expect(button.getAttribute('aria-expanded')).toBe('true');
		const info = document.getElementById(button.getAttribute('aria-controls')!)!;
		expect(info.textContent).toContain('en-US');
		expect(info.textContent).toContain('Hello');
		expect(info.textContent).toContain('--');
	});
});

test('option:system-input-translated-string.placeholder', async () => {
	const wrapper = await setup({ placeholder: 'Enter a name' });

	expect(wrapper.get('input').attributes('placeholder')).toBe('Enter a name');
});
