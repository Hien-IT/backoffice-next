import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';
import { useThemeConfiguration } from './use-theme-configuration.ts';

vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

let systemDark = false;
let onChange: ((event: { matches: boolean }) => void) | undefined;

beforeEach(() => {
	setActivePinia(createPinia());
	systemDark = false;

	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({
			matches: systemDark,
			addEventListener: (_: string, listener: typeof onChange) => (onChange = listener),
		})),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function setProject(project: Record<string, unknown>) {
	useServerStore().info.project = project as never;
}

function setUser(user: Record<string, unknown>) {
	useUserStore().currentUser = { id: 'u1', appearance: null, ...user } as never;
}

describe('useThemeConfiguration', () => {
	test('auto by default: follows prefers-color-scheme and its changes', () => {
		const { darkMode } = useThemeConfiguration();
		expect(darkMode.value).toBe(false);

		onChange!({ matches: true });
		expect(darkMode.value).toBe(true);

		onChange!({ matches: false });
		expect(darkMode.value).toBe(false);
	});

	test('dark system on start', () => {
		systemDark = true;
		expect(useThemeConfiguration().darkMode.value).toBe(true);
	});

	test('settings default_appearance applies when the user has none', () => {
		systemDark = true;
		setProject({ default_appearance: 'light' });
		setUser({ appearance: null });

		expect(useThemeConfiguration().darkMode.value).toBe(false);
	});

	test('user appearance wins over the settings; auto follows the system again', () => {
		setProject({ default_appearance: 'light' });
		setUser({ appearance: 'dark' });
		const { darkMode } = useThemeConfiguration();
		expect(darkMode.value).toBe(true);

		(useUserStore().currentUser as { appearance: string }).appearance = 'auto';
		expect(darkMode.value).toBe(false);
		onChange!({ matches: true });
		expect(darkMode.value).toBe(true);
	});

	test('share users (no appearance field) use the settings', () => {
		setProject({ default_appearance: 'dark' });
		useUserStore().currentUser = { share: 's1', admin_access: false, app_access: false };

		expect(useThemeConfiguration().darkMode.value).toBe(true);
	});

	test('merges the settings overrides over the user overrides, like Directus', () => {
		setProject({
			theme_light_overrides: { primary: '#111111', navigation: { background: 'white', foreground: 'black' } },
			theme_dark_overrides: { primary: '#222222' },
		});
		setUser({ theme_light_overrides: { primary: '#aa0000', navigation: { background: 'silver' } } });

		const { themeLightOverrides, themeDarkOverrides } = useThemeConfiguration();

		expect(themeLightOverrides.value).toEqual({
			primary: '#111111',
			navigation: { background: 'white', foreground: 'black' },
		});
		expect(themeDarkOverrides.value).toEqual({ primary: '#222222' });
	});

	test('theme names: the user choice, then the project default, else null (feature 015, FR-085)', () => {
		expect(useThemeConfiguration().themeLight.value).toBeNull();

		setProject({ default_theme_light: 'Directus Minimal', default_theme_dark: 'Directus Default' });
		setUser({ theme_light: 'Directus Color Match', theme_dark: null });

		const { themeLight, themeDark } = useThemeConfiguration();
		expect(themeLight.value).toBe('Directus Color Match');
		expect(themeDark.value).toBe('Directus Default');
	});

	test('no settings and no user: empty overrides', () => {
		const { themeLightOverrides, themeDarkOverrides } = useThemeConfiguration();
		expect(themeLightOverrides.value).toEqual({});
		expect(themeDarkOverrides.value).toEqual({});
	});
});
