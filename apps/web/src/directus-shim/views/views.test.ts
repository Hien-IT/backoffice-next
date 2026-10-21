// Spec 020 T115: the Directus views of extensions (PrivateView, PublicView, SharedView) on the app shell: slots land in
// the page header, the detail panel and the content; back button; `main-element`; SharedView title fallback.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, inject, type Ref, ref } from 'vue';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { getInternalModules, registeredModules } from '../../modules/index.ts';
import { type Settings, useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import type { AppUser } from '../../types/user.ts';
import PrivateView from './PrivateView.vue';
import PublicView from './PublicView.vue';
import SharedView from './SharedView.vue';

vi.mock('../../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(true), xl: ref(true) }),
}));
vi.mock('../../router/index.ts', () => ({ router: {} }));
vi.mock('../../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => {
	localStorage.clear();
	createSdk('http://api.test/');
	registeredModules.value = getInternalModules();
});

const q = (selector: string) => document.body.querySelector(selector);

function renderPrivate(props: Record<string, unknown>, slots: Record<string, string> = {}) {
	return mountLayout(PrivateView, {
		path: '/content',
		props,
		slots: { default: '<p data-body>Body</p>', ...slots },
		beforeMount: () => {
			useUserStore().currentUser = { id: 'u1', first_name: 'Ada', app_access: true } as AppUser;
			useSettingsStore().settings = { module_bar: null } as Settings;
		},
	});
}

describe('PrivateView', () => {
	test('slots land in the sidebar, page header, detail panel and content; only `class` is applied', async () => {
		const { wrapper } = await renderPrivate(
			{ title: 'My module', class: 'ext-page', 'data-x': 'no' },
			{
				navigation: '<p data-nav>Nav</p>',
				headline: '<span data-headline>Headline</span>',
				'title-outer:prepend': '<span data-outer-prepend>op</span>',
				'title:prepend': '<span data-title-prepend>tp</span>',
				'title:append': '<span data-title-append>ta</span>',
				'title-outer:append': '<span data-outer-append>oa</span>',
				'actions:prepend': '<button type="button" data-action>A1</button>',
				actions: '<button type="button" data-action>A2</button>',
				'actions:append': '<button type="button" data-action>A3</button>',
				sidebar: '<p data-details>Details</p>',
			},
		);

		expect(q('aside#navigation [data-nav]')).not.toBeNull();
		const header = q('[data-page-header]')!;
		const h1 = header.querySelector('h1')!;
		expect(h1.textContent!.trim()).toBe('My module');
		expect(h1.previousElementSibling!.hasAttribute('data-title-prepend')).toBe(true);
		expect(h1.nextElementSibling!.hasAttribute('data-title-append')).toBe(true);
		expect(header.querySelector('[data-headline]')).not.toBeNull();
		expect(header.querySelector('[data-outer-prepend]')).not.toBeNull();
		expect(header.querySelector('[data-outer-append]')).not.toBeNull();
		expect([...header.querySelectorAll('[data-action]')].map((el) => el.textContent)).toEqual(['A1', 'A2', 'A3']);
		expect(q('main#main-content [data-body]')).not.toBeNull();

		expect(wrapper.classes()).toContain('ext-page');
		expect(wrapper.attributes('data-x')).toBeUndefined();

		(q('button[aria-label="Open sidebar"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(q('aside#sidebar [data-details]')).not.toBeNull());
	});

	test('`title` replaces the h1; the icon hides `title-outer:prepend`', async () => {
		await renderPrivate(
			{ title: 'Ignored', icon: 'box' },
			{ title: '<h2 data-own-title>Own</h2>', 'title-outer:prepend': '<span data-outer-prepend>op</span>' },
		);

		expect(q('[data-page-header] h1')).toBeNull();
		expect(q('[data-page-header] [data-own-title]')).not.toBeNull();
		expect(q('[data-outer-prepend]')).toBeNull();
		expect(q('[data-page-header] [data-icon="box"]')).not.toBeNull();
	});

	test('showBack: back link to backTo instead of the icon; without backTo the browser history', async () => {
		const { wrapper } = await renderPrivate({
			title: 'Item',
			icon: 'box',
			showBack: true,
			backTo: '/content/articles',
		});

		const back = q('[data-page-header] a[aria-label="Back"]')!;
		expect(back.getAttribute('href')).toBe('/content/articles');
		expect(q('[data-page-header] [data-icon="box"]')).toBeNull();
		wrapper.unmount();

		const { router } = await renderPrivate({ title: 'Item', showBack: true });
		const spy = vi.spyOn(router, 'back');
		(q('[data-page-header] button[aria-label="Back"]') as HTMLButtonElement).click();
		expect(spy).toHaveBeenCalled();
	});

	test('provides `main-element`: the scrolling content of the page', async () => {
		let mainElement: Ref<Element | undefined> | undefined;
		const Probe = defineComponent({
			setup() {
				mainElement = inject('main-element');
				return () => h('p', 'probe');
			},
		});

		await mountLayout(
			{ render: () => h(PrivateView, { title: 'T' }, { default: () => h(Probe) }) },
			{
				beforeMount: () => {
					useUserStore().currentUser = { id: 'u1', app_access: true } as AppUser;
					useSettingsStore().settings = { module_bar: null } as Settings;
				},
			},
		);

		const el = mainElement!.value as HTMLElement;
		expect(el.classList).toContain('overflow-auto');
		expect(el.closest('main#main-content')).not.toBeNull();
		expect(el.textContent).toContain('probe');
	});
});

describe('PublicView and SharedView', () => {
	beforeEach(() => setActivePinia(createPinia()));

	const mountView = (component: typeof PublicView | typeof SharedView, props = {}, slots = {}) =>
		mount(component, { props, slots, global: { plugins: [i18n] } });

	const column = (wrapper: ReturnType<typeof mountView>) =>
		wrapper.get('[data-testid="public-title"]').element.closest('.rounded-2xl')!.classList;

	test('PublicView: default and notice slots; `wide` widens the column', () => {
		const narrow = mountView(
			PublicView,
			{},
			{ default: '<p data-content>form</p>', notice: '<span data-notice>n</span>' },
		);
		expect(narrow.find('[data-content]').exists()).toBe(true);
		expect(narrow.find('[data-notice]').exists()).toBe(true);
		expect(column(narrow)).toContain('max-w-md');

		expect(column(mountView(PublicView, { wide: true }))).toContain('max-w-160');
	});

	test('SharedView: title fallback, `title` prop and slot, `inline` keeps the narrow column', () => {
		const fallback = mountView(SharedView, {}, { default: '<p data-content>c</p>' });
		expect(fallback.get('h1.type-title').text()).toBe('Access Shared Page');
		expect(fallback.find('[data-content]').exists()).toBe(true);
		expect(column(fallback)).toContain('max-w-160');

		expect(mountView(SharedView, { title: 'Report' }).get('h1.type-title').text()).toBe('Report');

		const own = mountView(SharedView, { inline: true }, { title: '<h1 data-own>Own</h1>' });
		expect(own.find('h1.type-title').exists()).toBe(false);
		expect(own.find('[data-own]').exists()).toBe(true);
		expect(column(own)).toContain('max-w-md');
	});
});
