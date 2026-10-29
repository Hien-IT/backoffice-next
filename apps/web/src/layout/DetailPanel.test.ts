import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { useAutoRefresh } from '../composables/use-auto-refresh.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import DetailPanel from './DetailPanel.vue';
import { useSidebarStore } from './stores/sidebar.ts';

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

const aside = () => document.body.querySelector('aside[aria-label="Sidebar"]');
const button = (label: string) =>
	document.body.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

describe('DetailPanel (L-4, popover owner 2026-10-20)', () => {
	test('the toggle opens a popover with the labelled aside; label and aria-expanded follow the store', async () => {
		await mountLayout(DetailPanel, { slots: { default: '<p>Details</p>' } });
		const sidebarStore = useSidebarStore();
		sidebarStore.collapse();
		await vi.waitFor(() => expect(aside()).toBeNull());

		const toggle = button('Open sidebar')!;
		expect(toggle.getAttribute('aria-expanded')).toBe('false');

		toggle.click();
		await vi.waitFor(() => expect(aside()!.textContent).toBe('Details'));
		expect(sidebarStore.collapsed).toBe(false);
		expect(aside()!.id).toBe('sidebar');
		expect(button('Close sidebar')!.getAttribute('aria-expanded')).toBe('true');
	});

	test('Esc closes it and gives focus back to the toggle; focus moving out keeps it open', async () => {
		await mountLayout(DetailPanel, { slots: { default: '<button type="button">Inside</button>' } });
		const sidebarStore = useSidebarStore();
		sidebarStore.collapse();
		await vi.waitFor(() => expect(aside()).toBeNull());

		const toggle = button('Open sidebar')!;
		toggle.focus();
		sidebarStore.expand();
		await vi.waitFor(() => expect(aside()).not.toBeNull());

		const outside = document.createElement('button');
		document.body.append(outside);
		outside.focus();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(sidebarStore.collapsed).toBe(false);
		outside.remove();

		aside()!.querySelector('button')!.focus();
		await press(document.activeElement!, 'Escape');
		expect(sidebarStore.collapsed).toBe(true);
		await vi.waitFor(() => expect(aside()).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(button('Open sidebar')));
	});

	test('the toggle shows a dot while the page auto refreshes (D-199)', async () => {
		const interval = ref<number | null>(10);
		const Page = defineComponent({
			setup() {
				useAutoRefresh(interval, () => {});
				return () => h(DetailPanel, null, { default: () => 'Details' });
			},
		});

		await mountLayout(Page);
		useSidebarStore().collapse();
		const dot = () => document.body.querySelector('[data-auto-refresh-dot]');
		await vi.waitFor(() => expect(dot()).not.toBeNull());
		const describedBy = button('Open sidebar')!.getAttribute('aria-describedby')!;
		expect(document.getElementById(describedBy)!.textContent).toBe('Auto Refresh');

		interval.value = null;
		await vi.waitFor(() => expect(dot()).toBeNull());
		expect(button('Open sidebar')!.hasAttribute('aria-describedby')).toBe(false);
	});
});
