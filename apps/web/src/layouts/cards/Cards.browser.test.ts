// T057 in a real browser: the cards layout over the fixture API, rendered as the collection screen does
// (`<component :is="layout.component" v-bind="layoutState">`, the actions and options slots likewise).
import type { Filter } from '@directus/types';
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { createLayoutWrapper } from '../use-layout.ts';
import cards from './index.ts';

// The registry imports every layout eagerly; this test needs only the cards wrapper.
vi.mock('../index.ts', () => ({ getLayouts: () => [] }));

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

async function setup(answers = {}) {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { answers });
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
	useServerStore().info.queryLimit = { default: 100, max: 100 };
}

beforeEach(() => setup());

async function mountCards(
	initial: {
		layoutQuery?: any;
		layoutOptions?: any;
		filterUser?: Filter | null;
		filter?: Filter | null;
		filterSystem?: Filter | null;
	} = {},
	waitCards = true,
) {
	const layoutQuery = ref(initial.layoutQuery ?? null);
	const layoutOptions = ref(initial.layoutOptions ?? null);
	const selection = ref<(string | number)[]>([]);
	const Wrapper = createLayoutWrapper(cards);

	const Harness = defineComponent(
		() => () =>
			h(
				Wrapper,
				{
					collection: 'bo_content',
					layoutQuery: layoutQuery.value,
					layoutOptions: layoutOptions.value,
					selection: selection.value,
					filterUser: initial.filterUser ?? null,
					filter: initial.filter ?? initial.filterUser ?? null,
					filterSystem: initial.filterSystem ?? null,
					resetPreset: async () => undefined,
					'onUpdate:layoutQuery': (value: any) => (layoutQuery.value = value),
					'onUpdate:layoutOptions': (value: any) => (layoutOptions.value = value),
					'onUpdate:selection': (value: any) => (selection.value = value),
				},
				{
					default: ({ layoutState }: { layoutState: Record<string, any> }) =>
						h('div', [
							h('header', [h(cards.slots.actions, layoutState)]),
							h('aside', [h(cards.slots.options, layoutState)]),
							h(cards.component, layoutState, {
								'no-items': () => h('p', { 'data-test': 'no-items' }, 'empty'),
								'no-results': () => h('p', { 'data-test': 'no-results' }, 'no results'),
								error: ({ error }: { error: any }) =>
									h('p', { 'data-test': 'error' }, String(error?.errors?.[0]?.message)),
							}),
						]),
				},
			),
	);

	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/bo_content');
	const wrapper = mount(Harness, { global: { plugins: [router, i18n] }, attachTo: document.body });
	if (waitCards) await vi.waitFor(() => expect(cardLinks().length).toBeGreaterThan(0));
	await flushPromises();

	return { wrapper, router, layoutQuery, layoutOptions, selection };
}

const cardLinks = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/content/bo_content/"]')];
const cardBoxes = () => cardLinks().map((link) => link.parentElement!);
const checkbox = (name: string) => document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${name}"]`)!;

/** BoSelect trigger by its label text. */
function select(label: string) {
	const el = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === label)!;
	return document.getElementById(el.htmlFor)!;
}

async function choose(label: string, option: string) {
	await userEvent.click(select(label));
	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent?.includes(option))!,
	);
	await flushPromises();
}

test('renders the cards with image, fallback icon and title template, the header, count line and pagination', async () => {
	await mountCards({ layoutOptions: { title: '{{ title }}', subtitle: '{{ status }}' } });

	expect(cardLinks()).toHaveLength(25);
	expect(cardLinks()[0]!.getAttribute('href')).toBe('/content/bo_content/1');
	expect(cardLinks()[0]!.textContent).toContain('Content 01 (edited)');
	expect(cardLinks()[0]!.textContent).toContain('Draft');

	// Item 1 has the PNG cover: /assets/<id>?key=system-medium-cover (Directus card.vue); the others have no cover.
	const img = cardLinks()[0]!.querySelector('img');
	if (img)
		expect(new URL(img.src).pathname + new URL(img.src).search).toMatch(/\/assets\/bo-4\?key=system-medium-cover$/);
	else expect(cardLinks()[0]!.textContent).toContain('insert_drive_file');
	expect(
		cardLinks()
			.filter((_, i) => i > 0)
			.some((link) => link.querySelector('.material-symbols-rounded')?.textContent === 'box'),
	).toBe(true);

	// Grid of size 4: 160 px columns.
	expect((cardLinks()[0]!.closest('.grid') as HTMLElement).style.gridTemplateColumns).toContain('160px');

	expect(document.querySelector('[role="status"]')!.textContent).toContain(
		i18n.global.t('start_end_of_count_items', { start: 1, end: 25, count: 30 }),
	);
	expect(document.querySelector('nav[aria-label="Bo Content"] [aria-current="page"]')?.textContent?.trim()).toBe('1');
	expect(select(i18n.global.t('sort_field')).textContent).toContain('ID');
	expect(select(i18n.global.t('per_page')).textContent).toContain('25');

	assertOnlyKnownRequests(calls(fetch));
});

test('selection: card checkbox, click in select mode, header clear and select all', async () => {
	const { router, selection } = await mountCards();

	// The checkboxes are hidden until hover/focus or a selection.
	expect(checkbox('Select 2').parentElement!.parentElement!.className).toContain('opacity-0');
	await userEvent.click(checkbox('Select 2'), { force: true });
	await vi.waitFor(() => expect(selection.value).toEqual([2]));
	expect(cardBoxes()[1]!.dataset['selected']).toBe('true');
	expect(cardBoxes()[1]!.className).toContain('ring-brand-500');
	expect(checkbox('Select 5').parentElement!.parentElement!.className).toContain('opacity-100');

	// With a selection a card click toggles instead of opening the item.
	await userEvent.click(cardLinks()[2]!);
	await vi.waitFor(() => expect(selection.value).toEqual([2, 3]));
	expect(router.currentRoute.value.fullPath).toBe('/content/bo_content');

	const header = document.querySelector<HTMLElement>('[role="checkbox"]')!;
	expect(header.getAttribute('aria-label')).toBe('2 Items Selected');
	expect(header.getAttribute('aria-checked')).toBe('mixed');
	await userEvent.click(header);
	await vi.waitFor(() => expect(selection.value).toEqual([]));
	await vi.waitFor(() => expect(header.getAttribute('aria-label')).toBe(i18n.global.t('select_all')));

	await userEvent.click(header);
	await vi.waitFor(() => expect(selection.value).toHaveLength(25));
});

test('keyboard: Tab reaches the card link, Enter opens the item, Space toggles in select mode', async () => {
	const { router, selection } = await mountCards();

	cardLinks()[0]!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/content/bo_content/1'));

	selection.value = [1];
	await flushPromises();
	cardLinks()[1]!.focus();
	await userEvent.keyboard(' ');
	await vi.waitFor(() => expect(selection.value).toEqual([1, 2]));

	// Tab from a card link goes to its checkbox (after the link), Space toggles it.
	await userEvent.tab();
	expect(document.activeElement?.getAttribute('aria-label')).toBe('Select 2');
	await userEvent.keyboard(' ');
	await vi.waitFor(() => expect(selection.value).toEqual([1]));
});

test('header: card size cycles 4 → 5 → 2, sort field and direction write the preset', async () => {
	const { layoutQuery, layoutOptions } = await mountCards();
	const sizeButton = () => document.querySelector<HTMLElement>(`button[aria-label="${i18n.global.t('card_size')}"]`)!;

	await userEvent.click(sizeButton());
	await vi.waitFor(() => expect(layoutOptions.value).toEqual({ size: 5 }));
	expect((cardLinks()[0]!.closest('.grid') as HTMLElement).style.gridTemplateColumns).toContain('200px');
	await userEvent.click(sizeButton());
	await vi.waitFor(() => expect(layoutOptions.value).toEqual({ size: 2 }));

	await choose(i18n.global.t('sort_field'), 'Title');
	await vi.waitFor(() => expect(layoutQuery.value.sort).toEqual(['title']));

	await userEvent.click(
		document.querySelector<HTMLElement>(`button[aria-label="${i18n.global.t('sort_direction')}"]`)!,
	);
	await vi.waitFor(() => expect(layoutQuery.value.sort).toEqual(['-title']));

	await choose(i18n.global.t('per_page'), '50');
	await vi.waitFor(() => expect(layoutQuery.value.limit).toBe(50));
	await vi.waitFor(() => expect(cardLinks()).toHaveLength(30));
});

test('options: image source deselect, image fit, title template typed and from the field picker', async () => {
	const { layoutOptions } = await mountCards();

	await choose(i18n.global.t('layouts.cards.image_source'), i18n.global.t('deselect'));
	await vi.waitFor(() => expect(layoutOptions.value).toEqual({ imageSource: null }));

	// Image fit (in Advanced) is disabled without an image source (Directus options.vue).
	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('aside button')].find((el) =>
			el.textContent?.trim().startsWith(i18n.global.t('advanced')),
		)!,
	);
	await vi.waitFor(() => expect(select(i18n.global.t('layouts.cards.image_fit')).hasAttribute('disabled')).toBe(true));

	const title = select(i18n.global.t('layouts.cards.title')) as HTMLInputElement;
	await userEvent.fill(title, 'Card ');
	await vi.waitFor(() => expect(layoutOptions.value.title).toBe('Card '));

	const picker = title.closest('.flex')!.querySelector<HTMLElement>(`[aria-label="${i18n.global.t('add_field')}"]`)!;
	await userEvent.click(picker);
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
	await userEvent.click(
		[...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="treeitem"]')].find(
			(el) => el.textContent?.trim() === 'Title',
		)!,
	);
	await vi.waitFor(() => expect(layoutOptions.value.title).toBe('Card {{ title }}'));
	await vi.waitFor(() => expect(cardLinks()[0]!.textContent).toContain('Card Content 01 (edited)'));
});

test('state slots: no-results with a user filter, no-items on an empty collection, error with the API error', async () => {
	const noMatch = { title: { _eq: 'nothing matches' } };

	const results = await mountCards({ filterUser: noMatch }, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="no-results"]')).not.toBeNull());
	expect(cardLinks()).toHaveLength(0);
	results.wrapper.unmount();

	const items = await mountCards({ filter: noMatch, filterSystem: noMatch }, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="no-items"]')).not.toBeNull());
	items.wrapper.unmount();

	await setup({
		'GET /items/bo_content': ({ url }: { url: URL }) =>
			url.searchParams.has('aggregate')
				? json({ data: [{ countDistinct: { id: 30 } }] })
				: json({ errors: [{ message: 'No access', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});
	await mountCards({}, false);
	await vi.waitFor(() => expect(document.querySelector('[data-test="error"]')?.textContent).toBe('No access'));
});
