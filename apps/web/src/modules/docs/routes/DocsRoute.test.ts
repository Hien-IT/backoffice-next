// Spec 033 T020 (FR-001, FR-004, FR-007, FR-009, FR-011, FR-012, FR-019, FR-043; contracts/web.md §3): the documentation
// route in the app shell.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import type { Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { renderDoc } from '../../../docs/render.ts';
import { i18n } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import type { AppUser } from '../../../types/user.ts';
import DocsRoute from './DocsRoute.vue';

// The renderer is the real one, wrapped so a test can make a load fail.
vi.mock('../../../docs/render.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../docs/render.ts')>();
	return { ...actual, renderDoc: vi.fn(actual.renderDoc) };
});

// One extra page that only Backoffice has.
vi.mock('../../../docs/nav.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../docs/nav.ts')>();
	return {
		...actual,
		findPage: (path: string, nav = actual.docsNav) =>
			path === 'guides/only-here'
				? { ...nav.intro, path, title: 'Chỉ ở đây', backofficeOnly: true }
				: actual.findPage(path, nav),
	};
});

// The wide layout: the sidebar (with the documentation menu) is inline, not a closed drawer.
vi.mock('../../../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(true), xl: ref(true) }),
}));

enableAutoUnmount(afterEach);

const scrollIntoView = vi.fn();
let reducedMotion = false;

// The content in Vietnamese (the app language vi-VN); one test below opens the English content.
beforeEach(() => {
	i18n.global.locale.value = 'vi-VN';
	scrollIntoView.mockReset();
	reducedMotion = false;
	Element.prototype.scrollIntoView = scrollIntoView;
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
	window.matchMedia = ((query: string) => ({
		matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
	})) as unknown as typeof window.matchMedia;
});

afterEach(() => {
	vi.mocked(renderDoc).mockClear();
	i18n.global.locale.value = 'en-US';
});

const ROUTES: RouteRecordRaw[] = [
	{ path: '/docs/:path(.*)*', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function open(path: string, beforeMount?: (pinia: Pinia) => void) {
	const mounted = await mountLayout(DocsRoute, { path, routes: ROUTES, ...(beforeMount ? { beforeMount } : {}) });
	// The content is a dynamic import: wait until the skeleton of the first load is gone.
	await vi.waitFor(() => expect(mounted.wrapper.find('[data-docs-loading]').exists()).toBe(false));
	await flushPromises();
	return mounted;
}

const title = () => document.querySelector('#main-content h1')?.textContent?.trim();

describe('DocsRoute', () => {
	test('/docs is the introduction: title, lead, article, the menu in the sidebar, "On this page", the next page', async () => {
		const { wrapper } = await open('/docs');

		expect(title()).toBe('Bắt đầu');
		expect(wrapper.find('[data-docs-lead]').text()).toContain('ba phần');
		expect(wrapper.find('[data-docs-breadcrumb]').exists()).toBe(false);
		expect(wrapper.find('.docs-article').attributes('lang')).toBe('vi');
		expect(wrapper.findAll('.docs-article h2').map((h2) => h2.attributes('id'))).toEqual([
			'ba-phan-cua-tai-lieu',
			'cach-di-lai',
			'gui-link-toi-mot-muc',
		]);
		expect(wrapper.find('.docs-note-info').exists()).toBe(true);
		expect(wrapper.find('[data-docs-navigation]').exists()).toBe(true);
		expect(wrapper.findAll('[data-docs-toc] a').map((a) => a.attributes('href'))).toEqual([
			'#ba-phan-cua-tai-lieu',
			'#cach-di-lai',
			'#gui-link-toi-mot-muc',
		]);
		expect(wrapper.find('[data-docs-previous]').exists()).toBe(false);
		// The guides come first in the menu after the introduction.
		expect(wrapper.find('[data-docs-next]').attributes('href')).toBe('/docs/guides/content');
		expect(wrapper.find('[data-docs-main]').attributes('aria-busy')).toBeUndefined();
	});

	test('a configuration page: breadcrumb, the tables of the group, the default of PUBLIC_URL from the API list', async () => {
		const { wrapper } = await open('/docs/configuration/general');

		expect(title()).toBe('Chung');
		expect(wrapper.find('[data-docs-breadcrumb]').text()).toBe('Configuration');
		expect(wrapper.findAll('h2').map((h2) => h2.attributes('id'))).toEqual([
			'chung',
			'may-chu-http',
			'tai-khoan-admin-dau-tien',
		]);

		const row = wrapper.find('tr[data-variable="PUBLIC_URL"]');
		expect(row.findAll('td')[2]!.text()).toBe('/');
		expect(wrapper.find('tr[data-variable="SERVER_*"]').exists()).toBe(true);
		expect(wrapper.findAll('[data-docs-toc] a').map((a) => a.text())).toEqual([
			'Chung',
			'Máy chủ HTTP',
			'Tài khoản admin đầu tiên',
		]);
		// The last page of the API part (the Backoffice routes) comes before the first configuration page.
		expect(wrapper.find('[data-docs-previous]').attributes('href')).toBe('/docs/api/backoffice');
	});

	// Amendment 2026-11-18: English content for every app language but Vietnamese; a language change reloads the page.
	test('en-US shows the English content; switching to vi-VN shows the same page in Vietnamese', async () => {
		i18n.global.locale.value = 'en-US';
		const { wrapper } = await open('/docs/configuration/general');

		expect(title()).toBe('General');
		expect(wrapper.find('[data-docs-lead]').attributes('lang')).toBe('en');
		expect(wrapper.findAll('h2').map((h2) => h2.attributes('id'))).toEqual([
			'general',
			'http-server',
			'first-admin-account',
		]);
		expect(wrapper.find('tr[data-variable="PUBLIC_URL"]').findAll('td')[2]!.text()).toBe('/');

		i18n.global.locale.value = 'vi-VN';
		await vi.waitFor(() => expect(title()).toBe('Chung'));
		await vi.waitFor(() => expect(wrapper.findAll('h2').map((h2) => h2.attributes('id'))[0]).toBe('chung'));
		expect(wrapper.find('[data-docs-lead]').attributes('lang')).toBe('vi');
	});

	test('an API page: the resource, one card per endpoint, "On this page" lists the endpoints', async () => {
		const { wrapper } = await open('/docs/api/files');

		expect(title()).toBe('Files');
		expect(wrapper.find('[data-docs-breadcrumb]').text()).toBe('API');
		expect(wrapper.find('[data-docs-lead]').text()).toContain('endpoint của Files');
		expect(wrapper.findAll('section[data-operation]').length).toBeGreaterThan(3);
		expect(wrapper.find('#list-files').exists()).toBe(true);
		expect(wrapper.findAll('[data-docs-toc] a').map((a) => a.attributes('href'))).toContain('#list-files');
	});

	test('the Backoffice API page starts with the notice and sits in its own menu group', async () => {
		const { wrapper } = await open('/docs/api/backoffice');

		expect(wrapper.find('[data-docs-breadcrumb]').text()).toBe('API / Chỉ có ở Backoffice');
		expect(wrapper.find('[data-docs-backoffice-only]').exists()).toBe(true);
		expect(wrapper.find('[data-operation="createIndex"]').exists()).toBe(true);
	});

	test('an unknown documentation path: not found inside the frame, with a link home', async () => {
		const { wrapper } = await open('/docs/no/such/page');

		expect(title()).toBe('Page Not Found');
		expect(wrapper.find('[data-docs-main]').text()).toContain("doesn't seem to exist");
		expect(wrapper.find('[data-docs-main] a').attributes('href')).toBe('/docs');
		expect(wrapper.find('[data-docs-navigation]').exists()).toBe(true);
		expect(wrapper.find('.docs-article').exists()).toBe(false);
		expect(wrapper.find('[data-docs-toc]').exists()).toBe(false);
	});

	test('a page only Backoffice has starts with the notice', async () => {
		const { wrapper } = await open('/docs/guides/only-here');

		expect(title()).toBe('Chỉ ở đây');
		expect(wrapper.find('[data-docs-backoffice-only]').text()).toContain(
			'Available only when the server is Backoffice.',
		);
		expect((await open('/docs')).wrapper.find('[data-docs-backoffice-only]').exists()).toBe(false);
	});

	test('a failed load shows the error and a retry; the menu stays', async () => {
		vi.mocked(renderDoc).mockImplementationOnce(() => {
			throw new Error('chunk gone');
		});
		const { wrapper } = await open('/docs');

		expect(wrapper.find('[data-docs-error]').text()).toContain('This page could not be loaded.');
		expect(wrapper.find('.docs-article').exists()).toBe(false);
		expect(wrapper.find('[data-docs-navigation]').exists()).toBe(true);

		await wrapper.find('[data-docs-error] button').trigger('click');
		await vi.waitFor(() => expect(wrapper.find('.docs-article').exists()).toBe(true));

		expect(wrapper.find('[data-docs-error]').exists()).toBe(false);
	});

	test('a URL with an anchor scrolls to that heading and focuses it; an unknown anchor is ignored', async () => {
		const { router } = await open('/docs#cach-di-lai');

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect((scrollIntoView.mock.instances[0] as unknown as Element).id).toBe('cach-di-lai');
		// After a load the jump is instant; a jump inside the page on screen is smooth.
		expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
		expect(document.activeElement?.id).toBe('cach-di-lai');

		await router.replace({ hash: '#khong-co' });
		await flushPromises();
		expect(scrollIntoView).toHaveBeenCalledTimes(1);

		await router.replace({ hash: '#gui-link-toi-mot-muc' });
		await flushPromises();
		expect((scrollIntoView.mock.instances[1] as unknown as Element).id).toBe('gui-link-toi-mot-muc');
		expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
	});

	test('reduced motion: a jump inside the page is instant too', async () => {
		reducedMotion = true;
		const { router } = await open('/docs');

		await router.replace({ hash: '#cach-di-lai' });
		await flushPromises();

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
	});

	test('changing page keeps the page shown until the next is ready, then starts at the top with the focus on the title', async () => {
		const { wrapper, router } = await open('/docs');

		await router.push('/docs/configuration/general');
		// Not loaded yet: the introduction is still on screen, no skeleton.
		expect(wrapper.find('[data-docs-loading]').exists()).toBe(false);
		expect(title()).toBe('Bắt đầu');

		await vi.waitFor(() => expect(title()).toBe('Chung'));
		await flushPromises();

		expect(wrapper.find('tr[data-variable="PORT"]').exists()).toBe(true);
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
		expect(document.activeElement).toBe(document.querySelector('#main-content h1'));
	});

	test('the first load does not move the focus or the scroll position', async () => {
		await open('/docs');

		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	test('a user without app access sees the no-access screen, not the documentation', async () => {
		const { wrapper } = await open('/docs', (pinia) => {
			useUserStore(pinia).currentUser = { id: 'u1', app_access: false, admin_access: false } as AppUser;
		});

		expect(wrapper.find('[data-docs]').exists()).toBe(false);
		expect(wrapper.find('.docs-article').exists()).toBe(false);
	});
});
