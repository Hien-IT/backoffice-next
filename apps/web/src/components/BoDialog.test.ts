import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BoDialog from './BoDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('BoDialog', () => {
	test('renders a named, described dialog with content and actions; Esc closes', async () => {
		const wrapper = mount(BoDialog, {
			props: { open: true, title: 'Sign Out', description: 'Are you sure?' },
			slots: { default: '<p>Body</p>', actions: '<button type="button">OK</button>' },
			attachTo: document.body,
		});
		await flushPromises();

		const dialog = document.body.querySelector('[role="dialog"]')!;
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Sign Out');
		expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toContain('Are you sure?');
		expect(dialog.textContent).toContain('Body');
		expect(dialog.contains(document.activeElement)).toBe(true);

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('update:open')).toEqual([[false]]);
		wrapper.unmount();
	});

	test('persistent: an outside click keeps it open, Esc still closes', async () => {
		const wrapper = mount(BoDialog, {
			props: { open: true, title: 'Create Role', persistent: true },
			attachTo: document.body,
		});
		// Reka adds its outside listener in a timeout after opening; 200 ms covers a loaded runner.
		await new Promise((resolve) => setTimeout(resolve, 200));

		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('update:open')).toBeUndefined();

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('update:open')).toEqual([[false]]);
		wrapper.unmount();
	});

	test('not persistent: an outside click closes', async () => {
		const wrapper = mount(BoDialog, { props: { open: true, title: 'Sign Out' }, attachTo: document.body });
		await flushPromises();

		// Reka adds its outside listener in a timeout after opening: click until it is there (later on a loaded runner).
		await vi.waitFor(() => {
			document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
			expect(wrapper.emitted('update:open')).toEqual([[false]]);
		});
		wrapper.unmount();
	});

	test('without description: no aria-describedby and no Reka warning; closed renders nothing', async () => {
		const warn = vi.spyOn(console, 'warn');
		const wrapper = mount(BoDialog, { props: { open: true, title: 'Error' }, attachTo: document.body });
		await flushPromises();

		expect(document.body.querySelector('[role="dialog"]')!.hasAttribute('aria-describedby')).toBe(false);
		expect(warn).not.toHaveBeenCalled();

		await wrapper.setProps({ open: false });
		await flushPromises();
		expect(document.body.querySelector('[role="dialog"]')).toBeNull();
		wrapper.unmount();
	});
});
