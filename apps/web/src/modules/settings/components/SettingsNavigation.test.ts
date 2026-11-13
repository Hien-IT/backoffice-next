// Feature 016 T018 (FR-003, D-93, D-94, D-95, layout-patterns §12): the Settings sub-menu.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import SettingsNavigation from './SettingsNavigation.vue';

enableAutoUnmount(afterEach);

// Spec 032 (D-214.1): Environment Sync follows the probe of useEnvironmentSync (DR 404 → no row).
const sync = vi.hoisted(() => ({ available: { value: false } }));
vi.mock('../../../composables/use-environment-sync.ts', async () => {
	const { ref } = await import('vue');
	const available = ref(false);
	sync.available = available;
	return { useEnvironmentSync: () => ({ available, ready: Promise.resolve(true) }) };
});

beforeEach(() => setActivePinia(createPinia()));

/** The row label without the icon ligature. */
const label = (row: { find: (s: string) => { text: () => string } }) => row.find('.truncate').text();

async function setup(path = '/settings/data-model') {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push(path);
	return mount(SettingsNavigation, { global: { plugins: [i18n, router] } });
}

describe('SettingsNavigation', () => {
	test('four groups (Marketplace and Extensions since spec 020), no AI/System Logs, no report links, no version row', async () => {
		const wrapper = await setup();
		const lists = wrapper.findAll('ul');

		expect(lists.map((ul) => ul.findAll('a').map(label))).toEqual([
			['Data Model', 'Flows'],
			['User Roles', 'Access Policies'],
			['Settings', 'Appearance', 'Bookmarks', 'Translations'],
			['Marketplace', 'Extensions'],
		]);
		expect(wrapper.findAll('[role="separator"]')).toHaveLength(3);
		expect(wrapper.text()).not.toMatch(/System Logs|AI|Report Bug|Request Feature|Backoffice/);
	});

	test('spec 032: Environment Sync ends the first group when the API is Backoffice', async () => {
		sync.available.value = true;
		const wrapper = await setup('/settings/sync');
		const first = wrapper.findAll('ul')[0]!;

		expect(first.findAll('a').map(label)).toEqual(['Data Model', 'Flows', 'Environment Sync']);
		expect(first.find('a[href="/settings/sync"]').attributes('aria-current')).toBe('page');
		sync.available.value = false;
	});

	test('the active row follows the route prefix', async () => {
		const wrapper = await setup('/settings/data-model/articles');
		const current = wrapper.findAll('[aria-current="page"]');

		expect(current).toHaveLength(1);
		expect(label(current[0]!)).toBe('Data Model');
	});
});
