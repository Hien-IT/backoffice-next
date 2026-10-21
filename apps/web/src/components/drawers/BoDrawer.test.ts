import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { h } from 'vue';
import { i18n } from '../../lang/index.ts';
import BoDrawer from './BoDrawer.vue';

enableAutoUnmount(afterEach);

async function mountDrawer(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
	const wrapper = mount(BoDrawer, {
		props: { title: 'Edit item', modelValue: true, ...props },
		slots: { default: () => h('input', { id: 'first' }), ...slots },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]');

test('renders the title, the subtitle as description and the body', async () => {
	await mountDrawer({ subtitle: 'Articles' });

	const dialog = panel()!;
	expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Edit item');
	expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
	expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent?.trim()).toBe('Articles');
	expect(dialog.querySelector('main #first')).not.toBeNull();
	expect(dialog.className).toContain('xl:w-[640px]');
	expect(dialog.className).toContain('w-full');
});

test('without a subtitle the dialog has no description', async () => {
	await mountDrawer();
	expect(panel()!.hasAttribute('aria-describedby')).toBe(false);
});

test('the close button has a label and emits cancel; Esc emits cancel without closing by itself', async () => {
	const wrapper = await mountDrawer();
	const close = panel()!.querySelector<HTMLButtonElement>('header button')!;

	expect(close.getAttribute('aria-label')).toBe('Cancel');
	close.click();
	expect(wrapper.emitted('cancel')).toHaveLength(1);

	panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	await flushPromises();
	expect(wrapper.emitted('cancel')).toHaveLength(2);
	expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	expect(panel()).not.toBeNull();
});

test('cancelable false: no close button and Esc does nothing', async () => {
	const wrapper = await mountDrawer({ cancelable: false });

	expect(panel()!.querySelector('[aria-label="Cancel"]')).toBeNull();
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	await flushPromises();
	expect(wrapper.emitted('cancel')).toBeUndefined();
});

test('the apply shortcut emits apply (meta+enter by default, meta+s when set)', async () => {
	const wrapper = await mountDrawer();

	panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
	panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
	expect(wrapper.emitted('apply')).toHaveLength(1);

	await wrapper.setProps({ applyShortcut: 'meta+s' });
	panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true }));
	expect(wrapper.emitted('apply')).toHaveLength(2);
});

test('the actions slot sits in the header and the icon uses iconColor', async () => {
	await mountDrawer(
		{ icon: 'star', iconColor: '#FF0000' }, // raw-color-allowed: test of a data color applied with style
		{ actions: () => h('button', { class: 'save' }, 'Save') },
	);

	expect(panel()!.querySelector('header .save')).not.toBeNull();
	const icon = panel()!.querySelector<HTMLElement>('header .header-icon')!;
	expect(icon.textContent?.trim()).toBe('star');
	expect(icon.getAttribute('style')).toMatch(/color: (#FF0000|rgb\(255, 0, 0\))/i); // raw-color-allowed: same test color
});

test('the activator slot opens a drawer without v-model', async () => {
	const wrapper = mount(BoDrawer, {
		props: { title: 'Local' },
		slots: { activator: ({ on }: { on: () => void }) => h('button', { class: 'open', onClick: on }, 'Open') },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	expect(panel()).toBeNull();
	await wrapper.get('button.open').trigger('click');
	await flushPromises();
	expect(panel()).not.toBeNull();
	expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
});

test('a nested drawer has a transparent overlay so the page dims once', async () => {
	await mountDrawer({}, { default: () => h(BoDrawer, { title: 'Nested', modelValue: true }) });
	await flushPromises();

	const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
	expect(dialogs.map((d) => d.dataset['depth'])).toEqual(['0', '1']);

	const overlays = [...document.querySelectorAll<HTMLElement>('.bo-drawer-overlay')];
	expect(overlays[0]!.className).toContain('bg-gray-900/50');
	expect(overlays[1]!.className).toContain('bg-transparent');
});

test('the sidebar is named by sidebarLabel, "Sidebar" when unset (spec 020)', async () => {
	await mountDrawer({}, { sidebar: () => h('nav', 'Filters') });
	expect(panel()!.querySelector('aside')?.getAttribute('aria-label')).toBe('Sidebar');
});

test('sidebarLabel names the sidebar and its toggle (spec 020)', async () => {
	await mountDrawer({ sidebarLabel: 'Versions' }, { sidebar: () => h('nav', 'Filters') });

	const aside = panel()!.querySelector('aside')!;
	expect(aside.getAttribute('aria-label')).toBe('Versions');
	expect(aside.querySelector('button')?.textContent).toContain('Versions');
});
