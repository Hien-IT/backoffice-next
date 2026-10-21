// Spec 020 (Q-44): axe (wcag2a/aa, wcag21a/aa; serious and critical) on an open BoPopover, light and `html.dark`, and
// keyboard access: Enter opens, the focus moves in, Esc closes and the focus returns to the activator.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, describe, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import '../styles/index.css';
import BoPopover from './BoPopover.vue';

enableAutoUnmount(afterEach);
afterEach(() => document.documentElement.classList.remove('dark'));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const Page = defineComponent({
	props: { initial: Boolean },
	setup(props) {
		const open = ref(props.initial);

		return () =>
			h('main', { class: 'bg-white p-24 dark:bg-gray-900' }, [
				h(
					BoPopover,
					{
						open: open.value,
						'onUpdate:open': (value: boolean) => (open.value = value),
						side: 'bottom',
						align: 'start',
						arrow: true,
					},
					{
						activator: () =>
							h('button', { type: 'button', class: 'opener text-gray-700 dark:text-gray-300' }, 'Filters'),
						default: () => [
							h('p', 'Show archived items'),
							h(
								'button',
								{ type: 'button', class: 'first rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300' },
								'Apply',
							),
						],
					},
				),
			]);
	},
});

async function violations(): Promise<string[]> {
	// The open animation fades the panel in: axe measures the contrast at full opacity.
	await Promise.all(document.getAnimations().map((animation) => animation.finished));
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

const panel = () => document.querySelector<HTMLElement>('.bo-popover');

describe('BoPopover', () => {
	test.each(['light', 'dark'])('no serious or critical axe violation when open (%s)', async (theme) => {
		if (theme === 'dark') document.documentElement.classList.add('dark');
		mount(Page, { props: { initial: true }, attachTo: document.body });
		await flushPromises();

		expect(panel()).not.toBeNull();
		expect(panel()!.dataset['side']).toBe('bottom');
		expect(panel()!.dataset['align']).toBe('start');
		expect(await violations()).toEqual([]);
	});

	test('keyboard: Enter opens and moves the focus in, Esc closes and the focus returns', async () => {
		const wrapper = mount(Page, { attachTo: document.body });
		const opener = wrapper.get('button.opener').element as HTMLElement;

		opener.focus();
		await userEvent.keyboard('{Enter}');
		await flushPromises();

		expect(panel()).not.toBeNull();
		expect(panel()!.contains(document.activeElement)).toBe(true);
		expect(opener.getAttribute('aria-expanded')).toBe('true');

		await userEvent.keyboard('{Escape}');
		await expect.poll(() => panel()).toBeNull();
		expect(document.activeElement).toBe(opener);
	});
});
