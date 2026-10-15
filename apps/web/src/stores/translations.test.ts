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

test('create posts the row, reloads the current language and merges it into i18n', async () => {
	const row = { language: 'en-US', key: 'custom_created', value: 'Created' };
	request.mockImplementation(async (command: { method?: string }) => (command.method === 'POST' ? row : [row]));

	const store = useTranslationsStore();
	await store.create(row);
	await nextTick();

	expect(request).toHaveBeenNthCalledWith(1, { path: '/translations', method: 'POST', body: row });
	expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/translations', method: 'GET' }));
	expect(i18n.global.t('custom_created')).toBe('Created');
});

test('create reports a failed request through unexpectedError and does not reload', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	request.mockRejectedValue({ errors: [{ extensions: { code: 'FORBIDDEN' } }] });

	const store = useTranslationsStore();
	await store.create({ language: 'en-US', key: 'k', value: 'v' });

	expect(request).toHaveBeenCalledTimes(1);
	expect(warn).toHaveBeenCalled();
	warn.mockRestore();
});
