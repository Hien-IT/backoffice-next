import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import { mountLayout } from '../test-utils/layout.ts';
import PageHeader from './PageHeader.vue';
import { useSidebarStore } from './stores/sidebar.ts';

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

const button = (label: string) =>
	document.body.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

describe('PageHeader', () => {
	test('icon, h1 title and actions slot', async () => {
		const { wrapper } = await mountLayout(PageHeader, {
			props: { title: 'Content', icon: 'folder' },
			slots: { actions: '<button type="button">Act</button>' },
		});

		expect(wrapper.get('h1').text()).toBe('Content');
		expect(wrapper.text()).toContain('folder');
		expect(wrapper.text()).toContain('Act');
	});

	test('no breadcrumb shown (D-101), icon color and title-append slot (feature 014)', async () => {
		const { wrapper } = await mountLayout(PageHeader, {
			props: {
				title: 'Articles',
				icon: 'box',
				iconColor: '#6644FF',
				breadcrumb: [{ name: 'Content', to: '/content' }],
			},
			slots: { 'title-append': '<span data-append>bookmark</span>' },
		});

		expect(wrapper.find('nav[aria-label="Breadcrumb"]').exists()).toBe(false);
		expect(wrapper.text()).not.toContain('Content');
		expect(wrapper.get('h1').element.previousElementSibling?.getAttribute('style')).toContain('color');
		expect(wrapper.find('[data-append]').exists()).toBe(true);
	});

	test('detail panel toggle only when the page has details (the `sidebar` slot)', async () => {
		await mountLayout(PageHeader, { props: { title: 'Content' } });
		expect(button('Open sidebar') ?? button('Close sidebar')).toBeNull();
	});

	test('detail panel toggle: label and aria-expanded follow the panel state', async () => {
		await mountLayout(PageHeader, { props: { title: 'Content' }, slots: { sidebar: '<p>Details</p>' } });
		const sidebarStore = useSidebarStore();

		expect(button('Close sidebar')!.getAttribute('aria-expanded')).toBe('true');

		button('Close sidebar')!.click();
		await nextTick();
		expect(sidebarStore.collapsed).toBe(true);
		expect(button('Open sidebar')!.getAttribute('aria-expanded')).toBe('false');
	});
});
