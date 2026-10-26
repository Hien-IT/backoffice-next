// Keyboard path of the filter (D-69, WCAG 2.1.1) in a real browser: Move down from the row menu reorders the rules,
// focus follows the moved rule's menu trigger and the new position is announced.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../../../lang/index.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import '../../../styles/index.css';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import SystemFilter from './SystemFilter.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();

beforeEach(() => {
	setActivePinia(createPinia());
	const fieldsStore = useFieldsStore();
	fieldsStore.fields = [...snapshot.fields, ...snapshot.systemFields].map(fieldsStore.parseField);
	useRelationsStore().relations = snapshot.relations;
});

const Harness = defineComponent(() => {
	const value = ref<Record<string, any> | null>({
		_and: [{ title: { _contains: 'Content' } }, { status: { _eq: 'draft' } }],
	});

	return () =>
		h('div', [
			h(SystemFilter, {
				value: value.value,
				collectionName: 'bo_content',
				onInput: (v: Record<string, any> | null) => (value.value = v),
			}),
			h('pre', { class: 'json' }, JSON.stringify(value.value)),
		]);
});

test('Move down with the keyboard reorders the rules and keeps focus on the moved rule', async () => {
	mount(Harness, {
		global: {
			plugins: [i18n, createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })],
		},
		attachTo: document.body,
	});

	document.querySelector<HTMLElement>('[aria-label="Options for Title"]')!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
	await userEvent.keyboard('{ArrowDown}');
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Move down'));
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() =>
		expect(document.querySelector('.json')!.textContent).toBe(
			JSON.stringify({ _and: [{ status: { _eq: 'draft' } }, { title: { _contains: 'Content' } }] }),
		),
	);
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Options for Title'));
	expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('Title moved to position 2 of 2');
});

// Spec 023 (D-187, FR-017): the JSON path step with the keyboard only, and axe on the form with its error.
test('JSON path: field list → form → Apply with the keyboard; no serious axe violation, light and dark', async () => {
	const { default: axe } = await import('axe-core');

	const JsonHarness = defineComponent(() => {
		const value = ref<Record<string, any> | null>(null);

		return () =>
			h('div', [
				h(SystemFilter, {
					value: value.value,
					collectionName: 'bo_std',
					includeJsonPath: true,
					onInput: (v: Record<string, any> | null) => (value.value = v),
				}),
				h('pre', { class: 'json' }, JSON.stringify(value.value)),
			]);
	});

	mount(JsonHarness, {
		global: {
			plugins: [i18n, createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })],
		},
		attachTo: document.body,
	});

	document.querySelector<HTMLElement>('.add-filter')!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="tree"]')).not.toBeNull());

	const tags = [...document.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((el) =>
		el.textContent?.includes('Tags'),
	)!;
	tags.focus();
	await userEvent.keyboard('{ArrowRight}');
	await vi.waitFor(() =>
		expect(
			[...document.querySelectorAll('[role="treeitem"]')].some((el) => el.textContent?.includes('JSON path (Tags)')),
		).toBe(true),
	);
	await userEvent.keyboard('{ArrowDown}{ArrowDown}');
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('JSON path (Tags)'));
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() => expect(document.activeElement?.getAttribute('placeholder')).toBe('Amount, items[*].sku'));
	await userEvent.keyboard('items[[{Enter}');
	await vi.waitFor(() => expect(document.querySelector('.json-path-form [role="alert"]')).not.toBeNull());

	for (const scheme of ['light', 'dark']) {
		document.documentElement.classList.toggle('dark', scheme === 'dark');
		const results = await axe.run(document.body, {
			runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
		});
		const serious = results.violations
			.filter((v) => v.impact === 'serious' || v.impact === 'critical')
			.flatMap((v) => v.nodes.map((n) => `${scheme} ${v.id}: ${n.target.join(' ')}`));
		expect(serious).toEqual([]);
	}

	document.documentElement.classList.remove('dark');

	await userEvent.clear(document.activeElement as HTMLElement);
	await userEvent.keyboard('Amount');
	await userEvent.tab();
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('combobox'));
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('option'));
	await userEvent.keyboard('{ArrowDown}');
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Number'));
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Number'));
	await userEvent.tab();
	await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Apply'));
	await userEvent.keyboard('{Enter}');

	await vi.waitFor(() =>
		expect(document.querySelector('.json')!.textContent).toBe(
			JSON.stringify({ _and: [{ 'json(tags, Amount, number)': { _eq: null } }] }),
		),
	);
});
