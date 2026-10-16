// Feature 016 T018 (FR-003, D-93, D-94, D-95, layout-patterns §12): the Settings sub-menu.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { useSettingsStore } from '../../../stores/settings.ts';
import SettingsNavigation from './SettingsNavigation.vue';

enableAutoUnmount(afterEach);

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
	test('five groups minus the report links, no AI/Marketplace/Extensions/System Logs, then the static Backoffice row', async () => {
		const wrapper = await setup();
		const lists = wrapper.findAll('ul');

		expect(lists.map((ul) => ul.findAll('a').map(label))).toEqual([
			['Data Model', 'Flows'],
			['User Roles', 'Access Policies'],
			['Settings', 'Appearance', 'Bookmarks', 'Translations'],
		]);
		expect(wrapper.findAll('[role="separator"]')).toHaveLength(3);
		expect(wrapper.text()).not.toMatch(/Marketplace|Extensions|System Logs|AI/);
		expect(wrapper.find('p').text()).toBe('Backoffice');
		expect(wrapper.find('p a').exists()).toBe(false);
	});

	test('report links only with their URL, opening a new tab (D-94)', async () => {
		useSettingsStore().settings = { report_bug_url: 'https://bugs.example.com', report_feature_url: null } as never;
		const wrapper = await setup();
		const link = wrapper.find('a[href="https://bugs.example.com"]');

		expect(link.attributes('target')).toBe('_blank');
		expect(link.attributes('rel')).toBe('noopener noreferrer');
		expect(link.text()).toContain('Report Bug');
		expect(wrapper.text()).not.toContain('Request Feature');
	});

	test('the active row follows the route prefix', async () => {
		const wrapper = await setup('/settings/data-model/articles');
		const current = wrapper.findAll('[aria-current="page"]');

		expect(current).toHaveLength(1);
		expect(label(current[0]!)).toBe('Data Model');
	});
});
