// The user story 1 part of directus/app/src/modules/content/routes/collection.vue (no DR test): page header,
// layout and its slots from the registry, archive filter, create permission, not found, bookmark title.
import type { Preset } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mockApi } from '../../../test-utils/fetch.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import { useSidebarStore } from '../../../layout/stores/sidebar.ts';
import { useCollectionsStore, type Collection } from '../../../stores/collections.ts';
import { usePermissionsStore, type CollectionAccess } from '../../../stores/permissions.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import type { AppUser } from '../../../types/user.ts';
import CollectionRoute from './CollectionRoute.vue';
import PageHeader from '../../../layout/PageHeader.vue';

vi.mock('../../../layouts/index.ts', () => {
	const slot = (name: string) =>
		defineComponent({ inheritAttrs: false, setup: () => () => h('div', { [`data-${name}`]: '' }, name) });

	const component = defineComponent({
		inheritAttrs: false,
		setup:
			(_, { attrs, slots }) =>
			() =>
				h('div', { 'data-layout': '', 'data-filter-system': JSON.stringify(attrs['filterSystem'] ?? null) }, [
					slots['no-items']?.(),
				]),
	});

	const tabular = {
		id: 'tabular',
		name: 'Table',
		icon: 'table_rows',
		component,
		slots: { options: slot('options'), sidebar: slot('sidebar'), actions: slot('actions') },
		setup: () => ({}),
	};

	return { getLayouts: () => [tabular], getLayout: (id: string) => (id === 'tabular' ? tabular : undefined) };
});

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const articles = {
	collection: 'articles',
	name: 'Articles',
	icon: 'article',
	color: '#2ECDA7',
	schema: { name: 'articles' },
	meta: { archive_field: 'status', archive_value: 'archived', archive_app_filter: true, hidden: false, group: null },
} as unknown as Collection;

function setup(props: Record<string, unknown>, permissions: CollectionAccess | null = null) {
	return mountLayout(CollectionRoute, {
		props: { collection: 'articles', ...props },
		beforeMount() {
			useCollectionsStore().collections = [articles];
			const admin = permissions === null;
			useUserStore().currentUser = { id: 'u1', admin_access: admin, app_access: true, role: null } as AppUser;
			// /permissions/me answers full access to every collection for an admin.
			usePermissionsStore().permissions = permissions ?? { articles: { read: { access: 'full', fields: ['*'] } } };
		},
	});
}

beforeEach(() => {
	mockApi({});
	localStorage.clear();
});

describe('CollectionRoute', () => {
	test('header, breadcrumb, layout component and slots, create link (admin)', async () => {
		const { wrapper } = await setup({});

		expect(wrapper.get('h1').text()).toBe('Articles');
		// D-101: the breadcrumb is passed to PageHeader but not shown.
		expect((wrapper.findComponent(PageHeader).props('breadcrumb') as { name: string }[])[0]!.name).toBe('Content');
		expect(wrapper.find('[data-layout]').exists()).toBe(true);
		expect(wrapper.find('[data-actions]').exists()).toBe(true);
		// The detail panel is a closed drawer below `xl` (happy-dom width): its sections are checked through the store.
		useSidebarStore().activeAccordionItem = 'layout';
		await flushPromises();
		expect(document.body.querySelector('[data-sidebar]')).not.toBeNull();
		expect(document.body.querySelector('[data-options]')).not.toBeNull();
		expect(wrapper.get('a[aria-label="Create Item"]').attributes('href')).toBe('/content/articles/+');
		// The no-items slot of the page: the empty state with its create button.
		expect(wrapper.text()).toContain('No Items');
	});

	test('archive filter: not archived by default, archived, all (FR-044)', async () => {
		const filterOf = async (archive: string | null) =>
			JSON.parse((await setup({ archive })).wrapper.get('[data-layout]').attributes('data-filter-system')!);

		expect(await filterOf(null)).toEqual({ status: { _neq: 'archived' } });
		expect(await filterOf('archived')).toEqual({ status: { _eq: 'archived' } });
		expect(await filterOf('all')).toBeNull();
	});

	test('no archive filter without read access to the archive field', async () => {
		const { wrapper } = await setup({}, { articles: { read: { access: 'full', fields: ['title'] } } });

		expect(wrapper.get('[data-layout]').attributes('data-filter-system')).toBe('null');
	});

	test('create is disabled without create permission (FR-098)', async () => {
		const { wrapper } = await setup({}, { articles: { read: { access: 'full', fields: ['*'] } } });
		const button = wrapper.get('button[aria-label="Not Allowed"]');

		expect(button.attributes('disabled')).toBeDefined();
		expect(wrapper.find('a[aria-label="Create Item"]').exists()).toBe(false);
	});

	test('unknown and system collections show not found', async () => {
		expect((await setup({ collection: 'nope' })).wrapper.get('h1').text()).toBe('Page Not Found');
		expect((await setup({ collection: 'directus_users' })).wrapper.get('h1').text()).toBe('Page Not Found');
	});

	test('a bookmark shows its title and the collection breadcrumb', async () => {
		const { wrapper } = await mountLayout(CollectionRoute, {
			props: { collection: 'articles', bookmark: '4' },
			beforeMount() {
				useCollectionsStore().collections = [articles];
				useUserStore().currentUser = { id: 'u1', admin_access: true, app_access: true, role: null } as AppUser;
				usePresetsStore().collectionPresets = [
					{ id: 4, collection: 'articles', user: 'u1', role: null, bookmark: 'Drafts', layout: 'tabular' } as Preset,
				];
			},
		});

		expect(wrapper.get('h1').text()).toBe('Drafts');
		expect((wrapper.findComponent(PageHeader).props('breadcrumb') as { name: string }[]).at(-1)!.name).toBe('Articles');
	});
});
