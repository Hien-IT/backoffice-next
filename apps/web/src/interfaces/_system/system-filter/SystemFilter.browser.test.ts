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
