import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { h } from 'vue';
import { i18n } from '../../lang/index.ts';
import VCard from './VCard.vue';
import VCardTitle from './VCardTitle.vue';
import VDialog from './VDialog.vue';
import VDrawer from './VDrawer.vue';
import VOverlay from './VOverlay.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

function mountDialog(props: Record<string, unknown> = {}) {
	const wrapper = mount(VDialog, {
		props: { modelValue: true, 'onUpdate:modelValue': (v: boolean) => wrapper.setProps({ modelValue: v }), ...props },
		slots: {
			default: () =>
				h(VCard, () => [h(VCardTitle, () => 'Delete item?'), h('button', { type: 'button', class: 'ok' }, 'OK')]),
		},
		global,
		attachTo: document.body,
	});

	return wrapper;
}

const key = (init: KeyboardEventInit) =>
	document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

describe('VDialog', () => {
	test('a centred dialog named by its card title, with the overlay behind and the focus inside', async () => {
		await mountDialog();
		await flushPromises();

		const panel = dialog()!;
		expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe('Delete item?');
		expect(panel.hasAttribute('aria-describedby')).toBe(false);
		expect(panel.className).toEqual(expect.stringContaining('justify-center'));
		expect(panel.className).toContain('z-99999');
		expect(panel.querySelector('.v-overlay')).not.toBeNull();
		expect(panel.contains(document.activeElement)).toBe(true);
	});

	test('without a heading the name is "Dialog"; placement right, keepBehind', async () => {
		mount(VDialog, {
			props: { modelValue: true, placement: 'right', keepBehind: true },
			slots: { default: () => h('button', { type: 'button' }, 'OK') },
			global,
			attachTo: document.body,
		});
		await flushPromises();

		const panel = dialog()!;
		expect(document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe('Dialog');
		expect(panel.className).toContain('justify-end');
		expect(panel.className).toContain('z-9999');
	});

	test('Esc emits esc and closes; an overlay click closes', async () => {
		const wrapper = mountDialog();
		await flushPromises();

		key({ key: 'Escape' });
		await flushPromises();
		expect(wrapper.emitted('esc')).toHaveLength(1);
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);

		await wrapper.setProps({ modelValue: true });
		await flushPromises();
		dialog()!.querySelector<HTMLElement>('.v-overlay')!.click();
		expect(wrapper.emitted('update:modelValue')).toEqual([[false], [false]]);
	});

	test('persistent: Esc emits esc but keeps it open, an overlay click nudges', async () => {
		const wrapper = mountDialog({ persistent: true });
		await flushPromises();

		key({ key: 'Escape' });
		dialog()!.querySelector<HTMLElement>('.v-overlay')!.click();
		await flushPromises();

		expect(wrapper.emitted('esc')).toHaveLength(1);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(dialog()!.className).toContain('nudge');
	});

	test('apply shortcut: meta+enter by default, meta+s when set; meta+s is swallowed otherwise', async () => {
		const wrapper = mountDialog();
		await flushPromises();

		key({ key: 'Enter', metaKey: true });
		key({ key: 'Enter', ctrlKey: true });
		expect(wrapper.emitted('apply')).toHaveLength(2);

		const outside: Event[] = [];
		document.addEventListener('keydown', (event) => outside.push(event), { once: true });
		key({ key: 's', metaKey: true });
		expect(wrapper.emitted('apply')).toHaveLength(2);
		expect(outside).toHaveLength(0);
		wrapper.unmount();

		const save = mountDialog({ applyShortcut: 'meta+s' });
		await flushPromises();
		key({ key: 's', ctrlKey: true });
		key({ key: 'Enter', metaKey: true });
		expect(save.emitted('apply')).toHaveLength(1);
	});

	test('the activator slot opens it without v-model', async () => {
		const wrapper = mount(VDialog, {
			slots: {
				activator: ({ on }: { on: () => void }) => h('button', { type: 'button', class: 'open', onClick: on }, 'Open'),
				default: () => h('p', 'Body'),
			},
			global,
			attachTo: document.body,
		});

		expect(dialog()).toBeNull();
		await wrapper.get('button.open').trigger('click');
		await flushPromises();
		expect(dialog()!.textContent).toContain('Body');
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
	});
});

describe('VOverlay', () => {
	test('fixed, clickable and inactive by default; active shows the slot; absolute; click emits the event', async () => {
		const wrapper = mount(VOverlay, { slots: { default: () => 'Loading' } });

		expect(wrapper.classes()).toEqual(expect.arrayContaining(['fixed', 'pointer-events-none', 'cursor-pointer']));
		expect(wrapper.text()).toBe('');

		await wrapper.setProps({ active: true, absolute: true, clickable: false });
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['absolute', 'pointer-events-auto']));
		expect(wrapper.classes()).not.toContain('cursor-pointer');
		expect(wrapper.text()).toBe('Loading');

		await wrapper.trigger('click');
		expect(wrapper.emitted('click')?.[0]?.[0]).toBeInstanceOf(MouseEvent);
	});
});

describe('VDrawer', () => {
	test('wraps BoDrawer: props, every slot, sidebarLabel and the emits', async () => {
		const wrapper = mount(VDrawer, {
			props: { title: 'Edit', subtitle: 'Articles', modelValue: true, icon: 'edit', sidebarLabel: 'Versions' },
			slots: {
				default: () => h('input', { 'aria-label': 'Name' }),
				sidebar: () => h('nav', 'Side'),
				actions: () => h('button', { type: 'button', class: 'save' }, 'Save'),
				'title-outer:prepend': () => h('span', { class: 'prepend' }, 'P'),
			},
			global,
			attachTo: document.body,
		});
		await flushPromises();

		const panel = dialog()!;
		expect(panel.querySelector('h2')?.textContent?.trim()).toBe('Edit');
		expect(panel.textContent).toContain('Articles');
		expect(panel.querySelector('header .save')).not.toBeNull();
		expect(panel.querySelector('header .prepend')).not.toBeNull();
		expect(panel.querySelector('aside')?.getAttribute('aria-label')).toBe('Versions');
		expect(panel.querySelector('.header-icon')?.textContent?.trim()).toBe('edit');

		panel.querySelector<HTMLElement>('header button')!.click();
		key({ key: 'Enter', metaKey: true });
		expect(wrapper.emitted('cancel')).toHaveLength(1);
		expect(wrapper.emitted('apply')).toHaveLength(1);
	});

	test('the activator slot gets `on`', async () => {
		const wrapper = mount(VDrawer, {
			props: { title: 'Local' },
			slots: { activator: ({ on }: { on: () => void }) => h('button', { type: 'button', class: 'open', onClick: on }) },
			global,
			attachTo: document.body,
		});

		await wrapper.get('button.open').trigger('click');
		await flushPromises();
		expect(dialog()).not.toBeNull();
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
	});
});
