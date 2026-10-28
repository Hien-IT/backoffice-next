import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { createSdk } from '../api/sdk.ts';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore, type Settings } from '../stores/settings.ts';
import { useUserStore } from '../stores/user.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import type { AppUser, ShareUser } from '../types/user.ts';
import PrivateView from './PrivateView.vue';

const breakpoints = vi.hoisted(() => ({ lg: true, xl: true }));

vi.mock('../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(breakpoints.lg), xl: ref(breakpoints.xl) }),
}));
vi.mock('../router/index.ts', () => ({ router: {} }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

/** 1280 and 1000 px against lg 1024 px and xl 1280 px. */
function viewport(width: 1280 | 1000) {
	breakpoints.lg = width >= 1024;
	breakpoints.xl = width >= 1280;
}

beforeEach(() => {
	localStorage.clear();
	viewport(1280);
	createSdk('http://api.test/');
	registeredModules.value = getInternalModules();
});

const ADMIN = { id: 'u1', first_name: 'Ada', admin_access: true, app_access: true, avatar: null };

async function render(user: Partial<AppUser> | ShareUser = ADMIN, props: Record<string, unknown> = {}) {
	return mountLayout(PrivateView, {
		path: '/content',
		props: { title: 'Content', icon: 'box', ...props },
		slots: {
			default: '<p>Body</p>',
			navigation: '<p>Nav items</p>',
			actions: '<button type="button">Act</button>',
			sidebar: '<p>Details</p>',
		},
		beforeMount: () => {
			useUserStore().currentUser = user as AppUser;
			useSettingsStore().settings = { module_bar: null } as Settings;
		},
	});
}

const q = (selector: string) => document.body.querySelector(selector);
const navAside = () => q('aside#navigation');
const sidebarAside = () => q('aside[aria-label="Sidebar"]');
const button = (label: string) => q(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

describe('PrivateView (FR-020, FR-028)', () => {
	test('from xl: the sidebar column (logo, module tiles, module navigation, user), page header in main; title; skip menu', async () => {
		const { head } = await render();

		const block = navAside()!.querySelector('[data-testid="module-rail"]')!;
		expect(block.querySelector('[data-testid="module-bar"] [aria-current="page"]')!.getAttribute('href')).toBe('/content');
		expect(block.querySelector('img[alt="Backoffice"]')).not.toBeNull();
		expect(navAside()!.querySelector('button[aria-label="Ada"]')).not.toBeNull();
		expect(navAside()!.querySelector('h2')!.textContent!.trim()).toBe('Content');
		expect(navAside()!.textContent).toContain('Nav items');
		expect((q('#navigation + div') as HTMLElement).style.marginInlineStart).toBe('290px');
		expect(q('main header button[aria-label="Toggle Navigation"]')).not.toBeNull();
		expect(q('main#main-content h1')!.textContent).toBe('Content');
		expect(q('main#main-content')!.textContent).toContain('Act');
		expect(q('main#main-content')!.textContent).toContain('Body');
		expect(sidebarAside()).toBeNull();
		expect(q('[role="dialog"]')).toBeNull();
		expect(q('a[href="#main-content"]')).not.toBeNull();
		expect(button('Open navigation')).toBeNull();

		button('Open sidebar')!.click();
		await vi.waitFor(() => expect(sidebarAside()!.textContent).toBe('Details'));

		const tags = await head.resolveTags();
		expect(tags.find((tag) => tag.tag === 'title')?.textContent).toBe('Content');
	});

	test('from xl: a hidden sidebar stays hidden (saved state), the content takes the width', async () => {
		localStorage.setItem('backoffice-nav-bar-collapsed', 'true');
		await render();

		expect(navAside()).toBeNull();
		expect(q('main')!.parentElement!.parentElement!.style.marginInlineStart).toBe('');
		expect(button('Toggle Navigation')!.getAttribute('aria-expanded')).toBe('false');

		button('Toggle Navigation')!.click();
		await vi.waitFor(() => expect((navAside() as HTMLElement).style.width).toBe('290px'));
		expect(localStorage.getItem('backoffice-nav-bar-collapsed')).toBe('false');
	});

	test('a page without navigation: the sidebar keeps the module tiles and the toggle', async () => {
		await mountLayout(PrivateView, {
			path: '/insights',
			props: { title: 'Insights' },
			slots: { default: '<p>Body</p>' },
			beforeMount: () => {
				useUserStore().currentUser = ADMIN as AppUser;
				useSettingsStore().settings = { module_bar: null } as Settings;
			},
		});

		expect(navAside()!.querySelector('[data-module-navigation]')!.textContent).toBe('');
		expect(button('Toggle Navigation')).not.toBeNull();
		expect(q('[data-testid="module-bar"] [aria-current="page"]')!.getAttribute('href')).toBe('/insights');
	});

	test('below xl: the sidebar is a drawer, the detail panel a popover; opened by keyboard, Esc closes, focus returns', async () => {
		viewport(1000);
		await render();

		// Below xl the whole column is the drawer.
		expect(q('[data-testid="module-bar"]')).toBeNull();
		expect(navAside()).toBeNull();
		expect(sidebarAside()).toBeNull();

		const openNav = button('Open navigation')!;
		openNav.focus();
		openNav.click();
		await vi.waitFor(() => expect(q('[role="dialog"] aside#navigation')).not.toBeNull());
		expect(q('[role="dialog"] aside#navigation')!.textContent).toContain('Nav items');

		await press(document.activeElement!, 'Escape');
		// The first focused tile may show its tooltip: the first Escape can close that.
		if (q('[role="dialog"]')) await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(q('[role="dialog"]')).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(openNav));

		button('Open sidebar')!.click();
		await vi.waitFor(() => expect(q('[role="dialog"] aside[aria-label="Sidebar"]')).not.toBeNull());
	});

	test('the content fills the width after the sidebar: no 1536 px cap, the page header spans it (owner 2026-10-18)', async () => {
		await render();

		expect(q('main')!.className).not.toMatch(/mx-auto|max-w-/);
		expect(q('main header')!.className).not.toMatch(/max-w-/);
	});

	test('user without app access: the no-app-access screen instead of the layout', async () => {
		const { wrapper } = await render({ ...ADMIN, admin_access: false, app_access: false });

		expect(wrapper.get('h1').text()).toBe('No App Access');
		expect(q('[data-testid="module-bar"]')).toBeNull();
	});

	test('share user: the layout (no app_access field to check)', async () => {
		await render({ share: 's1', admin_access: false, app_access: false });

		expect(q('[data-testid="module-bar"]')).not.toBeNull();
	});
});
