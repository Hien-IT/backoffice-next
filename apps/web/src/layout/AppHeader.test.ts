import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { createSdk } from '../api/sdk.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout } from '../test-utils/layout.ts';
import type { AppUser } from '../types/user.ts';
import AppHeader from './AppHeader.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

const breakpoints = vi.hoisted(() => ({ xl: true }));

vi.mock('../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(breakpoints.xl), xl: ref(breakpoints.xl) }),
}));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => {
	localStorage.clear();
	breakpoints.xl = true;
	createSdk('http://api.test/');
});

const button = (label: string) =>
	document.body.querySelector(`header button[aria-label="${label}"]`) as HTMLButtonElement | null;

async function render() {
	return mountLayout(AppHeader, {
		beforeMount: () => {
			useUserStore().currentUser = { id: 'u1', first_name: 'Ada', last_name: 'Lovelace', avatar: null } as AppUser;
		},
	});
}

describe('AppHeader (layout-patterns §4)', () => {
	test('from xl: "Toggle Navigation" collapses the inline sidebar, aria-expanded follows it', async () => {
		await render();
		const navBarStore = useNavBarStore();
		const toggle = button('Toggle Navigation')!;

		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(toggle.getAttribute('aria-controls')).toBe('navigation');

		toggle.click();
		await nextTick();
		expect(navBarStore.collapsed).toBe(true);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(button('Open navigation')).toBeNull();
	});

	test('below xl: "Open navigation" opens the drawer without touching the saved collapsed state', async () => {
		breakpoints.xl = false;
		await render();
		const navBarStore = useNavBarStore();

		expect(button('Toggle Navigation')).toBeNull();
		button('Open navigation')!.click();
		await nextTick();
		expect(navBarStore.drawerOpen).toBe(true);
		expect(navBarStore.collapsed).toBe(false);
		expect(button('Open navigation')!.getAttribute('aria-expanded')).toBe('true');
	});

	test('user menu trigger named after the user', async () => {
		await render();

		expect(button('Ada Lovelace')).not.toBeNull();
	});
});
