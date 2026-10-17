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
const navAside = () => q('aside[aria-label="Navigation"]');
const sidebarAside = () => q('aside[aria-label="Sidebar"]');
const button = (label: string) => q(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

describe('PrivateView (FR-020, FR-028)', () => {
	test('from xl: sidebar with the module sub-menu, header, page header, main and detail panel inline; title; skip menu', async () => {
		const { head } = await render();

		expect(navAside()!.id).toBe('navigation');
		expect(navAside()!.querySelector('[data-testid="module-bar"]')).not.toBeNull();
		expect(navAside()!.textContent).toContain('Backoffice');
		expect(navAside()!.textContent).toContain('Nav items');
		expect(q('header button[aria-label="Toggle Navigation"]')).not.toBeNull();
		expect(q('header button[aria-label="Ada"]')).not.toBeNull();
		expect(q('main#main-content h1')!.textContent).toBe('Content');
		expect(q('main#main-content')!.textContent).toContain('Act');
		expect(q('main#main-content')!.textContent).toContain('Body');
		expect(sidebarAside()!.textContent).toBe('Details');
		expect(q('[role="dialog"]')).toBeNull();
		expect(q('a[href="#main-content"]')).not.toBeNull();
		expect(button('Open navigation')).toBeNull();

		const tags = await head.resolveTags();
		expect(tags.find((tag) => tag.tag === 'title')?.textContent).toBe('Content');
	});

	test('from xl: a collapsed sidebar stays collapsed (saved state): 90 px rail, content margin follows', async () => {
		localStorage.setItem('backoffice-nav-bar-collapsed', 'true');
		await render();

		expect(navAside()!.className).toContain('w-[90px]');
		expect(navAside()!.textContent).not.toContain('Nav items');
		expect(q('#navigation + div')!.className).toContain('xl:ms-[90px]');
		expect(button('Toggle Navigation')!.getAttribute('aria-expanded')).toBe('false');

		button('Toggle Navigation')!.click();
		await vi.waitFor(() => expect(navAside()!.className).toContain('w-[290px]'));
		expect(localStorage.getItem('backoffice-nav-bar-collapsed')).toBe('false');
	});

	test('below xl: sidebar and detail panel are drawers, opened by keyboard, Esc closes, focus returns', async () => {
		viewport(1000);
		await render();

		expect(q('[data-testid="module-bar"]')).toBeNull();
		expect(navAside()).toBeNull();
		expect(sidebarAside()).toBeNull();

		const openNav = button('Open navigation')!;
		openNav.focus();
		openNav.click();
		await vi.waitFor(() => expect(q('[role="dialog"] [data-testid="module-bar"]')).not.toBeNull());
		expect(q('[role="dialog"] aside[aria-label="Navigation"]')!.textContent).toContain('Nav items');

		await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(q('[role="dialog"]')).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(openNav));

		button('Open sidebar')!.click();
		await vi.waitFor(() => expect(q('[role="dialog"] aside[aria-label="Sidebar"]')).not.toBeNull());
	});

	test('the content fills the width after the sidebar: no 1536 px cap, the page header spans it (owner 2026-10-18)', async () => {
		await render();

		expect(q('main')!.className).not.toMatch(/mx-auto|max-w-/);
		expect(q('main h1')!.closest('.mb-6')!.className).not.toMatch(/max-w-/);
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
