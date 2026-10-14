import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { i18n } from '../lang/index.ts';
import { useTranslationsStore } from './translations.ts';

const request = vi.fn();

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

beforeEach(() => {
	setActivePinia(createPinia());
	request.mockReset();
});

test('loads the rows of a language and merges them into i18n with literal @, $ and |', async () => {
	request.mockResolvedValue([
		{ language: 'en-US', key: 'custom_title', value: 'Orders' },
		{ language: 'en-US', key: 'custom_mail', value: 'a@b | {count} $' },
	]);

	const store = useTranslationsStore();
	await store.loadTranslations('en-US');
	await nextTick();

	expect(request).toHaveBeenCalledWith({
		path: '/translations',
		method: 'GET',
		params: { fields: ['language', 'key', 'value'], filter: { language: { _eq: 'en-US' } }, limit: -1 },
	});

	expect(store.translations).toHaveLength(2);
	expect(store.loading).toBe(false);
	expect(i18n.global.t('custom_title')).toBe('Orders');
	expect(i18n.global.t('custom_mail', { count: 2 })).toBe('a@b | 2 $');
});

test('a failed request (no permission) keeps the previous rows', async () => {
	request.mockRejectedValue({ errors: [{ extensions: { code: 'FORBIDDEN' } }] });

	const store = useTranslationsStore();
	await store.loadTranslations('vi-VN');

	expect(store.translations).toEqual([]);
	expect(store.loading).toBe(false);
});
