import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { getDateFNSLocale } from '../utils/get-date-fns-locale.ts';
import { i18n, loadedLanguages, MISSING_KEY_WARNING } from './index.ts';
import { getEffectiveLanguage, setLanguage } from './set-language.ts';

const request = vi.fn();

vi.mock('../api/sdk.ts', () => ({
	sdk: { request: (command: () => unknown) => request(command()) },
	requestEndpoint: (path: string, options: object) => () => ({ path, ...options }),
}));

const t = (key: string) => i18n.global.t(key);
const html = () => document.documentElement.getAttribute('lang');

beforeEach(() => {
	setActivePinia(createPinia());
	request.mockReset().mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

test('loads vi-VN on demand with the overlay, then sets the locale and html[lang]', async () => {
	expect(loadedLanguages).toEqual(['en-US']);

	await setLanguage('vi-VN');

	expect(loadedLanguages).toEqual(['en-US', 'vi-VN']);
	expect(i18n.global.locale.value).toBe('vi-VN');
	expect(html()).toBe('vi-VN');
	expect(t('module_placeholder')).toBe('Nội dung của mục này sẽ có ở phiên bản sau.');
	expect(t('sign_in')).not.toBe(i18n.global.t('sign_in', {}, { locale: 'en-US' }));
	expect(getDateFNSLocale()?.code).toBe('vi');

	expect(request).toHaveBeenCalledWith({
		path: '/translations',
		method: 'GET',
		params: { fields: ['language', 'key', 'value'], filter: { language: { _eq: 'vi-VN' } }, limit: -1 },
	});
});

test('a key missing in vi-VN falls back to en-US silently; a key missing everywhere warns once', async () => {
	await setLanguage('vi-VN');
	i18n.global.mergeLocaleMessage('en-US', { only_in_english: 'Only in English' });
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

	expect(t('only_in_english')).toBe('Only in English');
	expect(warn).not.toHaveBeenCalled();

	expect(t('no_such_key')).toBe('no_such_key');
	expect(t('no_such_key')).toBe('no_such_key');
	expect(warn).toHaveBeenCalledTimes(1);
	expect(warn).toHaveBeenCalledWith(MISSING_KEY_WARNING, 'no_such_key');
});

test('an available but not bundled language uses en-US strings and html[lang] en-US (D-46)', async () => {
	await setLanguage('vi-VN');
	await setLanguage('fr-FR');

	expect(getEffectiveLanguage('fr-FR')).toBe('en-US');
	expect(i18n.global.locale.value).toBe('en-US');
	expect(html()).toBe('en-US');
	expect(t('sign_in')).toBe('Sign In');
	expect(request.mock.calls.at(-1)?.[0].params.filter).toEqual({ language: { _eq: 'fr-FR' } });
});

test('an unknown language warns and keeps the current locale', async () => {
	await setLanguage('en-US');
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

	expect(await setLanguage('xx-YY')).toBe(true);

	expect(warn).toHaveBeenCalledWith('"xx-YY" is not an available language in the Backoffice app.');
	expect(i18n.global.locale.value).toBe('en-US');
});

test('GET /translations failing with 403 is ignored', async () => {
	request.mockRejectedValue({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] });
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

	expect(await setLanguage('vi-VN')).toBe(true);

	expect(i18n.global.locale.value).toBe('vi-VN');
	expect(error).not.toHaveBeenCalled();
});

test('translates the collections and the fields into the new language (FR-006)', async () => {
	await setLanguage('en-US');
	const collectionsStore = useCollectionsStore();
	const fieldsStore = useFieldsStore();

	collectionsStore.collections = [
		{ collection: 'posts', meta: { translations: [{ language: 'vi-VN', translation: 'Bài viết' }] }, schema: {} },
	].map((collection) => collectionsStore.prepareCollectionForApp(collection as never));
	fieldsStore.fields = [
		{ collection: 'directus_users', field: 'email', meta: { system: true, note: '$t:save' } },
	].map((field) => fieldsStore.parseField(field as never));

	expect(collectionsStore.collections[0]!.name).toBe('Posts');
	expect(fieldsStore.fields[0]!.name).toBe('Email');

	await setLanguage('vi-VN');

	expect(collectionsStore.collections[0]!.name).toBe('Bài viết');
	expect(fieldsStore.fields[0]!.name).toBe('Địa chỉ email');
	expect(fieldsStore.fields[0]!.meta!.note).toBe('Lưu');
});
