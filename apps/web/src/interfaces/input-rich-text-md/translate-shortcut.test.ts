// Ported from directus/packages/composables/src/translate-shortcut.test.ts
// Backoffice: navigator.platform is spied instead of replacing window.navigator.
import { afterEach, expect, test, vi } from 'vitest';
import { translateShortcut } from './translate-shortcut.ts';

const platform = (value: string) => vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(value);

afterEach(() => {
	vi.restoreAllMocks();
});

test('Windows/Linux', () => {
	platform('test');
	expect(translateShortcut(['meta', 's'])).toBe('Ctrl+S');
	expect(translateShortcut(['option', 's'])).toBe('Option+S');
	expect(translateShortcut(['alt', 's'])).toBe('Alt+S');
	expect(translateShortcut(['shift', 's'])).toBe('Shift+S');
});

test('macOS/iOS', () => {
	platform('MacIntel');

	expect(translateShortcut(['meta', 's'])).toBe('⌘S');
	expect(translateShortcut(['option', 's'])).toBe('⌥S');
	expect(translateShortcut(['alt', 's'])).toBe('⌥S');
	expect(translateShortcut(['shift', 's'])).toBe('⇧S');

	platform('iPad');

	expect(translateShortcut(['meta', 's'])).toBe('⌘S');
	expect(translateShortcut(['option', 's'])).toBe('⌥S');
	expect(translateShortcut(['alt', 's'])).toBe('⌥S');
	expect(translateShortcut(['shift', 's'])).toBe('⇧S');
});
