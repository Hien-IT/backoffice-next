// Spec 020 (T114, FR-075, design-system XII): the feedback and data shims in a real browser: axe finds no serious or
// critical WCAG 2.1 AA violation in light and dark, and the VResizeable bar resizes with the pointer and the keyboard.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import '../styles/theme-vars.css';
import VBreadcrumb from './VBreadcrumb.vue';
import VError from './VError.vue';
import VInfo from './VInfo.vue';
import VNotice from './VNotice.vue';
import VPagination from './VPagination.vue';
import VProgressCircular from './VProgressCircular.vue';
import VProgressLinear from './VProgressLinear.vue';
import VResizeable from './VResizeable.vue';
import VSkeletonLoader from './VSkeletonLoader.vue';
import VTable from './VTable.vue';
import VTextOverflow from './VTextOverflow.vue';
import VWorkspace from './VWorkspace.vue';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => document.documentElement.classList.remove('dark'));

async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

const Group = defineComponent(() => {
	const page = ref(2);
	const selection = ref<Record<string, any>[]>([]);
	const width = ref(240);

	return () =>
		h('main', { class: 'space-y-4 bg-white p-4 dark:bg-gray-900' }, [
			h(VNotice, { type: 'warning' }, { title: () => 'Heads up', default: () => 'Check the values.' }),
			h(VNotice, { type: 'danger', icon: false }, () => 'Failed.'),
			h('div', { class: 'relative h-64' }, [
				h(VInfo, { title: 'No items', icon: 'box', type: 'primary', center: true }, () => 'Create one.'),
			]),
			h(VError, { error: { errors: [{ message: 'No access', extensions: { code: 'FORBIDDEN' } }] } }),
			h(VSkeletonLoader, { type: 'list-item-icon' }),
			h(VProgressCircular, { value: 40, large: true }),
			h(VProgressLinear, { value: 60, colorful: true }),
			h(VPagination, {
				modelValue: page.value,
				length: 5,
				totalVisible: 5,
				'onUpdate:modelValue': (next: number) => (page.value = next),
			}),
			h(VBreadcrumb, {
				items: [
					{ name: 'Content', to: '/content' },
					{ name: 'Articles', to: '/x', disabled: true },
				],
			}),
			h('div', { class: 'w-24' }, [h(VTextOverflow, { text: 'A very long title that is cut' })]),
			h(VTable, {
				headers: [
					{ text: 'Name', value: 'name' },
					{ text: 'Status', value: 'status' },
				],
				items: [
					{ id: 1, name: 'Alpha', status: 'draft' },
					{ id: 2, name: 'Beta', status: 'published' },
				],
				showSelect: 'multiple',
				modelValue: selection.value,
				'onUpdate:modelValue': (next: Record<string, any>[]) => (selection.value = next),
			}),
			h(
				VResizeable,
				{ width: width.value, minWidth: 200, maxWidth: 400, 'onUpdate:width': (next: number) => (width.value = next) },
				() => h('aside', { class: 'pane h-20 border border-gray-200 dark:border-gray-800' }, 'Pane'),
			),
			h('div', { class: 'relative h-96 overflow-auto' }, [
				h(VWorkspace, {
					tiles: [{ id: 'a', x: 1, y: 1, width: 12, height: 8, name: 'Totals', note: 'Daily totals' }],
					editMode: true,
				}),
			]),
		]);
});

function mountGroup() {
	return mount(Group, { global: { plugins: [i18n, router] }, attachTo: document.body });
}

describe.each(['light', 'dark'] as const)('%s', (scheme) => {
	test('no serious or critical axe violation', async () => {
		document.documentElement.classList.toggle('dark', scheme === 'dark');
		mountGroup();
		await flushPromises();
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(await violations()).toEqual([]);
	});
});

test('VResizeable: the bar is focusable and resizes with the arrows and with a pointer drag', async () => {
	mountGroup();
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 100));

	const pane = document.querySelector<HTMLElement>('.pane')!;
	// The bar shows while the pane is in view (useElementVisibility, as DR).
	pane.scrollIntoView();
	await new Promise((resolve) => setTimeout(resolve, 100));
	const bar = document.querySelector<HTMLElement>('[role="separator"]')!;

	bar.focus();
	expect(document.activeElement).toBe(bar);
	await userEvent.keyboard('{ArrowRight}{ArrowRight}');
	await flushPromises();
	expect(pane.style.inlineSize).toBe('260px');

	// The drag starts from the rendered width: let the width transition end.
	await new Promise((resolve) => setTimeout(resolve, 400));
	const start = bar.getBoundingClientRect();
	const x = start.left + start.width / 2;
	const y = start.top + start.height / 2;
	const pointer = (type: string, target: EventTarget, clientX: number) =>
		target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX, clientY: y, button: 0, pointerId: 1 }));

	pointer('pointerdown', bar, x);
	pointer('pointermove', window, x + 50);
	await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
	pointer('pointerup', window, x + 50);
	await flushPromises();

	expect(pane.style.inlineSize).toBe('310px');
});
