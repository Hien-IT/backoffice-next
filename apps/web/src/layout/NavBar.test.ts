import { enableAutoUnmount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { useServerStore } from '../stores/server.ts';
import { mountLayout, press } from '../test-utils/layout.ts';
import NavBar from './NavBar.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

vi.mock('../composables/use-media-query.ts', () => ({
	useLayoutBreakpoints: () => ({ lg: ref(true), xl: ref(true) }),
}));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

enableAutoUnmount(afterEach);

beforeEach(() => localStorage.clear());

const aside = () => document.body.querySelector('aside[aria-label="Navigation"]');

describe('NavBar (FR-026)', () => {
	test('project name (Backoffice by default), slot, collapse button, resize handle', async () => {
		const { wrapper } = await mountLayout(NavBar, { slots: { default: '<p>Items</p>' } });

		expect(aside()!.textContent).toContain('Backoffice');
		expect(aside()!.textContent).toContain('Items');
		expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('225');

		await wrapper.get('button[aria-label="Toggle Navigation"]').trigger('click');
		await vi.waitFor(() => expect(aside()).toBeNull());
		expect(useNavBarStore().collapsed).toBe(true);
	});

	test('project_name and descriptor from /server/info', async () => {
		await mountLayout(NavBar, {
			beforeMount: () => {
				useServerStore().info.project = { project_name: 'Acme', project_descriptor: 'Admin' } as never;
			},
		});

		expect(aside()!.textContent).toContain('Acme');
		expect(aside()!.textContent).toContain('Admin');
		expect(aside()!.textContent).not.toContain('Backoffice');
	});

	test('drawer: modal dialog with the prepend slot, Esc closes', async () => {
		await mountLayout(NavBar, { props: { drawer: true }, slots: { prepend: '<p>Modules</p>' } });

		const dialog = document.body.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain('Modules');
		expect(dialog.querySelector('aside[aria-label="Navigation"]')).not.toBeNull();

		await press(document.activeElement!, 'Escape');
		await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
		expect(useNavBarStore().collapsed).toBe(true);
	});
});
