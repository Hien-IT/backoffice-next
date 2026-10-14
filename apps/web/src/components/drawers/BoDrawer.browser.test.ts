import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import BoDrawer from './BoDrawer.vue';

// Focus trap, Esc and focus return need real focus handling (chromium).
enableAutoUnmount(afterEach);

/** A page button opens drawer A; a button in A opens drawer B. Each drawer closes on cancel, like Directus parents. */
const Harness = defineComponent({
	props: { persistent: Boolean },
	setup(props) {
		const outer = ref(false);
		const inner = ref(false);

		return () => [
			h('button', { id: 'opener', onClick: () => (outer.value = true) }, 'Open'),
			h(
				BoDrawer,
				{
					title: 'Outer',
					modelValue: outer.value,
					persistent: props.persistent,
					'onUpdate:modelValue': (v: boolean) => (outer.value = v),
					onCancel: () => (outer.value = false),
				},
				{
					default: () => [
						h('input', { id: 'outer-input', 'aria-label': 'Name' }),
						h('button', { id: 'inner-opener', onClick: () => (inner.value = true) }, 'Open nested'),
						h(
							BoDrawer,
							{
								title: 'Inner',
								modelValue: inner.value,
								'onUpdate:modelValue': (v: boolean) => (inner.value = v),
								onCancel: () => (inner.value = false),
							},
							{ default: () => h('input', { id: 'inner-input', 'aria-label': 'Title' }) },
						),
					],
				},
			),
		];
	},
});

const active = () => document.activeElement?.id;
const dialogCount = () => document.querySelectorAll('[role="dialog"]').length;

function mountHarness(props: Record<string, unknown> = {}) {
	return mount(Harness, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

test('focus moves to the first field of the body, stays trapped and returns to the opener after Esc', async () => {
	mountHarness();

	await userEvent.click(document.getElementById('opener')!);
	await vi.waitFor(() => expect(active()).toBe('outer-input'));

	// Tab cycles inside the drawer: input → nested opener → close button (header) → input.
	for (let i = 0; i < 5; i++) {
		await userEvent.keyboard('{Tab}');
		expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
	}

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(dialogCount()).toBe(0));
	await vi.waitFor(() => expect(active()).toBe('opener'));
});

test('nested drawers: Esc closes only the top one and focus returns to its opener inside the drawer below', async () => {
	mountHarness();

	await userEvent.click(document.getElementById('opener')!);
	await vi.waitFor(() => expect(active()).toBe('outer-input'));

	document.getElementById('inner-opener')!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(active()).toBe('inner-input'));
	expect(dialogCount()).toBe(2);

	// The nested drawer is later in the DOM with the same z-index, so it is on top.
	const [outer, inner] = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
	expect(outer!.compareDocumentPosition(inner!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	expect(getComputedStyle(inner!).zIndex).toBe(getComputedStyle(outer!).zIndex);

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(dialogCount()).toBe(1));
	await vi.waitFor(() => expect(active()).toBe('inner-opener'));

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(dialogCount()).toBe(0));
	await vi.waitFor(() => expect(active()).toBe('opener'));
});

test('an overlay click closes the drawer unless persistent', async () => {
	const wrapper = mountHarness({ persistent: true });

	await userEvent.click(document.getElementById('opener')!);
	await vi.waitFor(() => expect(dialogCount()).toBe(1));

	const overlay = document.querySelector<HTMLElement>('.bo-drawer-overlay')!;
	overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(dialogCount()).toBe(1);

	await wrapper.setProps({ persistent: false });
	overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
	await vi.waitFor(() => expect(dialogCount()).toBe(0));
});

test('the panel is full width below xl and 640px from xl', async () => {
	mountHarness();

	await userEvent.click(document.getElementById('opener')!);
	await vi.waitFor(() => expect(dialogCount()).toBe(1));

	const panel = document.querySelector<HTMLElement>('[role="dialog"]')!;
	const expected = window.innerWidth >= 1280 ? 640 : window.innerWidth;
	expect(Math.round(panel.getBoundingClientRect().width)).toBe(expected);
});
