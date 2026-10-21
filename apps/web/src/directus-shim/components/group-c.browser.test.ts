// Spec 020 T112: axe (wcag2a/aa, wcag21a/aa; serious and critical) on the overlay group of the shim (VDialog with
// VOverlay, VMenu, VDrawer), light and `html.dark`, and the keyboard: a menu inside a dialog opens above it, Esc closes
// the top-most layer only and the focus goes back to the element that opened it.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import VCard from './VCard.vue';
import VCardText from './VCardText.vue';
import VCardTitle from './VCardTitle.vue';
import VDialog from './VDialog.vue';
import VDrawer from './VDrawer.vue';
import VMenu from './VMenu.vue';

enableAutoUnmount(afterEach);
afterEach(() => document.documentElement.classList.remove('dark'));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const text = 'rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300';

type SlotProps = { toggle: () => void; active: boolean };

const menu = (label: string) =>
	h(
		VMenu,
		{ placement: 'bottom-start' },
		{
			activator: ({ toggle, active }: SlotProps) =>
				h('button', { type: 'button', class: `menu-opener ${text}`, 'aria-expanded': active, onClick: toggle }, label),
			default: () =>
				h('ul', { class: 'space-y-1' }, [
					h('li', [h('button', { type: 'button', class: `item ${text}` }, 'Duplicate')]),
					h('li', [h('button', { type: 'button', class: `item ${text}` }, 'Archive')]),
				]),
		},
	);

const Page = defineComponent({
	props: { open: Boolean },
	emits: ['esc'],
	setup(props, { emit }) {
		const active = ref(props.open);

		return () =>
			h('main', { class: 'bg-white p-4 dark:bg-gray-900' }, [
				h(
					VDialog,
					{
						modelValue: active.value,
						'onUpdate:modelValue': (value: boolean) => (active.value = value),
						onEsc: () => emit('esc'),
					},
					{
						activator: ({ on }: { on: () => void }) =>
							h('button', { type: 'button', class: `dialog-opener ${text}`, onClick: on }, 'Open dialog'),
						default: () =>
							h(VCard, () => [
								h(VCardTitle, () => 'Move item'),
								h(VCardText, () => [
									h('p', { class: 'text-gray-700 dark:text-gray-300' }, 'Pick an action.'),
									menu('Actions'),
								]),
							]),
					},
				),
			]);
	},
});

async function violations(): Promise<string[]> {
	// The open animations fade the panels in: axe measures the contrast at full opacity.
	await Promise.all(document.getAnimations().map((animation) => animation.finished));
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

const global = { plugins: [i18n] };
const dialog = () => document.querySelector<HTMLElement>('.v-dialog-container');
const menuContent = () => document.querySelector<HTMLElement>('.v-menu-content');

/** The menu is the top element at its own centre: it stacks above the dialog or drawer. */
function onTop(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
}

describe('group C shims', () => {
	test.each(['light', 'dark'])('no serious or critical axe violation: dialog with an open menu (%s)', async (theme) => {
		if (theme === 'dark') document.documentElement.classList.add('dark');
		const wrapper = mount(Page, { props: { open: true }, global, attachTo: document.body });
		await flushPromises();

		await wrapper.vm.$nextTick();
		(document.querySelector('.menu-opener') as HTMLElement).click();
		await expect.poll(() => menuContent()).not.toBeNull();

		expect(dialog()!.getAttribute('aria-labelledby')).toBeTruthy();
		// Polled: Reka keeps the panel off screen until floating-ui has placed it.
		await expect.poll(() => onTop(menuContent()!)).toBe(true);
		expect(await violations()).toEqual([]);
	});

	test('keyboard: dialog then menu; Esc closes the menu, then the dialog, the focus returns each time', async () => {
		const wrapper = mount(Page, { global, attachTo: document.body });
		const opener = wrapper.get('button.dialog-opener').element as HTMLElement;

		opener.focus();
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => dialog()).not.toBeNull();

		const menuOpener = dialog()!.querySelector<HTMLElement>('.menu-opener')!;
		await expect.poll(() => document.activeElement).toBe(menuOpener);

		await userEvent.keyboard('{Enter}');
		await expect.poll(() => menuContent()).not.toBeNull();
		expect(document.activeElement).toBe(menuOpener);

		await userEvent.tab();
		expect(document.activeElement).toBe(menuContent()!.querySelector('.item'));
		await userEvent.tab();
		expect(document.activeElement?.textContent).toBe('Archive');

		await userEvent.keyboard('{Escape}');
		await expect.poll(() => menuContent()).toBeNull();
		expect(dialog()).not.toBeNull();
		expect(wrapper.emitted('esc')).toBeUndefined();
		await expect.poll(() => document.activeElement).toBe(menuOpener);

		await userEvent.keyboard('{Escape}');
		await expect.poll(() => dialog()).toBeNull();
		expect(wrapper.emitted('esc')).toHaveLength(1);
		await expect.poll(() => document.activeElement).toBe(opener);
	});

	test.each(['light', 'dark'])(
		'VDrawer with a sidebar and an open menu: axe, the menu above the drawer (%s)',
		async (theme) => {
			if (theme === 'dark') document.documentElement.classList.add('dark');
			mount(VDrawer, {
				props: { title: 'Edit article', subtitle: 'Articles', modelValue: true, sidebarLabel: 'Versions' },
				slots: {
					default: () => menu('More'),
					sidebar: () => h('nav', { class: 'p-4 text-gray-700 dark:text-gray-300' }, 'Main'),
				},
				global,
				attachTo: document.body,
			});
			await flushPromises();

			(document.querySelector('.menu-opener') as HTMLElement).click();
			await expect.poll(() => menuContent()).not.toBeNull();

			// Polled: Reka keeps the panel off screen until floating-ui has placed it.
			await expect.poll(() => onTop(menuContent()!)).toBe(true);
			expect(await violations()).toEqual([]);
		},
	);
});
