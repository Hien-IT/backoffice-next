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
			props: { title: 'Content', icon: 'box' },
			slots: { actions: '<button type="button">Act</button>' },
		});

		expect(wrapper.get('h1').text()).toBe('Content');
		expect(wrapper.text()).toContain('box');
		expect(wrapper.text()).toContain('Act');
	});

	test('detail panel toggle: label and aria-expanded follow the panel state', async () => {
		await mountLayout(PageHeader, { props: { title: 'Content' } });
		const sidebarStore = useSidebarStore();

		expect(button('Close sidebar')!.getAttribute('aria-expanded')).toBe('true');
		expect(button('Close sidebar')!.getAttribute('aria-controls')).toBe('sidebar');

		button('Close sidebar')!.click();
		await nextTick();
		expect(sidebarStore.collapsed).toBe(true);
		expect(button('Open sidebar')!.getAttribute('aria-expanded')).toBe('false');
	});
});
