import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { mountLayout, press } from '../test-utils/layout.ts';
import Sidebar from './Sidebar.vue';
import { useSidebarStore } from './stores/sidebar.ts';

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

const aside = () => document.body.querySelector('aside[aria-label="Sidebar"]');

describe('Sidebar', () => {
	test('inline: labelled aside with the slot, hidden when collapsed, resizable', async () => {
		const { wrapper } = await mountLayout(Sidebar, { slots: { default: '<p>Details</p>' } });
		const sidebarStore = useSidebarStore();

		expect(aside()!.textContent).toBe('Details');
		expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('333');

		await press(wrapper.get('[role="separator"]').element, 'ArrowLeft');
		expect(sidebarStore.size).toBe(349);

		sidebarStore.collapse();
		await vi.waitFor(() => expect(aside()).toBeNull());
	});

	test('drawer: modal dialog opened from the store, Esc closes it', async () => {
		const opener = document.createElement('button');
		document.body.append(opener);

		await mountLayout(Sidebar, { props: { drawer: true }, slots: { default: '<p>Details</p>' } });
		const sidebarStore = useSidebarStore();
		sidebarStore.collapse();
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());

		opener.focus();
		sidebarStore.expand();
		await nextTick();
		const dialog = document.body.querySelector('[role="dialog"]')!;
		expect(dialog.querySelector('button[aria-label="Close sidebar"]')).not.toBeNull();
		expect(aside()!.textContent).toBe('Details');

		await press(document.activeElement!, 'Escape');
		expect(sidebarStore.collapsed).toBe(true);
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(opener));
		opener.remove();
	});
});
