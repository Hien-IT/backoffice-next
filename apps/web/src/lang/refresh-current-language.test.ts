// DR has no test for refresh-current-language.ts (spec 016 T107, FR-086): the custom translations of the user's
// language load again, then the fields store (field names translate on hydrate); a failure only logs.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useFieldsStore } from '../stores/fields.ts';
import { useTranslationsStore } from '../stores/translations.ts';
import { useUserStore } from '../stores/user.ts';
import { refreshCurrentLanguage } from './refresh-current-language.ts';

// The user store switches the app language when `language` changes; not part of this test.
vi.mock('./set-language.ts', () => ({ setLanguage: vi.fn() }));

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());

test('loads the translations of the current language, then hydrates the fields', async () => {
	const order: string[] = [];
	const userStore = useUserStore();
	userStore.currentUser = { id: 'u1', language: 'vi-VN' } as never;
	const load = vi
		.spyOn(useTranslationsStore(), 'loadTranslations')
		.mockImplementation(async () => void order.push('translations'));
	vi.spyOn(useFieldsStore(), 'hydrate').mockImplementation(async () => void order.push('fields'));

	await refreshCurrentLanguage();

	expect(load).toHaveBeenCalledWith('vi-VN');
	expect(order).toEqual(['translations', 'fields']);
});

test('a failure is logged, not thrown', async () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	vi.spyOn(useTranslationsStore(), 'loadTranslations').mockResolvedValue();
	vi.spyOn(useFieldsStore(), 'hydrate').mockRejectedValue(new Error('nope'));

	await expect(refreshCurrentLanguage()).resolves.toBeUndefined();
	expect(error).toHaveBeenCalledWith('Failed loading translations');
});
