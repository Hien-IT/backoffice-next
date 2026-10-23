// DR has no test for user-info-sidebar-detail.vue: the key with its copy button, the last page link, the last
// access date; nothing for a new user (FR-074).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { useSidebarStore } from '../../../layout/stores/sidebar.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import UserInfoSidebarDetail from './UserInfoSidebarDetail.vue';

enableAutoUnmount(afterEach);

const USER = { id: 'u1', last_page: '/content/bo_content', last_access: '2026-10-16T10:00:00.000Z' };

async function setup(props: Record<string, unknown>) {
	const mounted = await mountLayout(UserInfoSidebarDetail, {
		props,
		beforeMount() {
			useSidebarStore().activeAccordionItem = 'user-info';
		},
	});
	await flushPromises();
	return mounted;
}

test('key, last page link and last access of a saved user', async () => {
	const { wrapper } = await setup({ user: USER, isNew: false });

	const text = wrapper.text();
	expect(text).toContain('u1');
	expect(wrapper.get('dd a').attributes('href')).toBe('/content/bo_content');
	expect(text).toMatch(/2026/);
});

test('a new user shows no rows', async () => {
	const { wrapper } = await setup({ user: USER, isNew: true });
	expect(wrapper.find('dl').exists()).toBe(false);
});
