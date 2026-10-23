// Spec 020 T115: axe (wcag2a/aa, wcag21a/aa; serious and critical) on the DR views of extensions (PrivateView
// with every slot and its detail panel open, PublicView, SharedView), light and `html.dark`.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { type Component, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createHead } from '@unhead/vue';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { getInternalModules, registeredModules } from '../../modules/index.ts';
import { type Settings, useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import type { AppUser } from '../../types/user.ts';
import '../../styles/index.css';
import '../styles/theme-vars.css';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import PrivateView from './PrivateView.vue';
import PublicView from './PublicView.vue';
import SharedView from './SharedView.vue';

enableAutoUnmount(afterEach);
afterEach(() => document.documentElement.classList.remove('dark'));

beforeEach(() => {
	localStorage.clear();
	createSdk('http://api.test/');
	registeredModules.value = getInternalModules();
});

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

async function mountView(component: Component, props: Record<string, unknown>, slots: Record<string, () => unknown>) {
	const pinia = createPinia();
	setActivePinia(pinia);
	useUserStore().currentUser = { id: 'u1', first_name: 'Ada', app_access: true } as AppUser;
	useSettingsStore().settings = { module_bar: null } as Settings;

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/content');

	const wrapper = mount(component, {
		props,
		slots,
		attachTo: document.body,
		global: { plugins: [pinia, router, i18n, createHead()] },
	});
	await flushPromises();
	return wrapper;
}

const text = 'text-gray-700 dark:text-gray-300';
const action = (label: string) => () => h('button', { type: 'button', class: `rounded-lg px-3 py-2 ${text}` }, label);

describe('extension views', () => {
	test.each(['light', 'dark'])('PrivateView: no serious or critical axe violation (%s)', async (theme) => {
		if (theme === 'dark') document.documentElement.classList.add('dark');

		await mountView(
			PrivateView,
			{ title: 'My module', icon: 'box', showBack: true, backTo: '/content' },
			{
				navigation: () => h('p', { class: text }, 'Sub-menu'),
				headline: () => h('span', { class: text }, 'Headline'),
				'title:prepend': () => h('span', { class: text }, 'Before'),
				'title:append': () => h('span', { class: text }, 'After'),
				'title-outer:append': () => h('span', { class: text }, 'Outer'),
				'actions:prepend': action('First'),
				actions: action('Save'),
				'actions:append': action('Last'),
				sidebar: () => h('p', { class: `p-4 ${text}` }, 'Details'),
				default: () => h('p', { class: text }, 'Body'),
			},
		);
		useSidebarStore().expand();
		await flushPromises();

		expect(document.querySelector('aside#sidebar')).not.toBeNull();
		expect(await violations()).toEqual([]);
	});

	test.each(['light', 'dark'])(
		'PublicView and SharedView: no serious or critical axe violation (%s)',
		async (theme) => {
			if (theme === 'dark') document.documentElement.classList.add('dark');

			const publicView = await mountView(
				PublicView,
				{ wide: true },
				{ default: () => h('p', { class: text }, 'Form'), notice: () => h('span', 'Notice') },
			);
			expect(await violations()).toEqual([]);
			publicView.unmount();

			await mountView(SharedView, { inline: true }, { default: () => h('p', { class: text }, 'Shared') });
			expect(await violations()).toEqual([]);
		},
	);
});
