// Backoffice (spec 032, T056, FR-035, SC-008): the parts of the Environment Sync page in chromium: no serious axe
// violation on the connect form, a group table with every state, the row detail and the confirm dialog; a row is ticked
// with the keyboard.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../../../../lang/index.ts';
import '../../../../styles/index.css';
import SyncConfirmDialog from './components/SyncConfirmDialog.vue';
import SyncConnectForm from './components/SyncConnectForm.vue';
import SyncGroup from './components/SyncGroup.vue';
import SyncRowDetail from './components/SyncRowDetail.vue';
import { GROUP_KEYS, type GroupKey, type SyncRow } from './types.ts';

enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));

const ROWS: SyncRow[] = [
	{
		id: 'flows/flow:a',
		group: 'flows',
		kind: 'flow',
		key: 'a',
		label: 'Nightly',
		state: 'source_only',
		depends: [],
		cascade: [],
		selectable: true,
		impact: { active: true },
	},
	{
		id: 'flows/flow:b',
		group: 'flows',
		kind: 'flow',
		key: 'b',
		label: 'Renamed',
		state: 'changed',
		depends: [],
		cascade: [],
		selectable: true,
		changes: [{ path: 'name', source: 'Renamed', target: 'Old' }],
	},
	{
		id: 'flows/flow:c',
		group: 'flows',
		kind: 'flow',
		key: 'c',
		label: 'Local',
		state: 'target_only',
		depends: [],
		cascade: [],
		selectable: true,
	},
	{
		id: 'flows/flow:d',
		group: 'flows',
		kind: 'flow',
		key: 'd',
		label: 'Blocked',
		state: 'target_only',
		depends: [],
		cascade: [],
		selectable: false,
		reason: 'sync_admin_protected',
	},
];

async function violations(root: Element) {
	const result = await axe.run(root, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

test('connect form and a group table: no serious axe violation; Space ticks a row', async () => {
	const selected = ref(new Set<string>());

	const wrapper = mount(
		defineComponent({
			setup: () => () =>
				h('main', [
					h(SyncConnectForm, { url: '', token: '', groups: [...GROUP_KEYS] as GroupKey[], busy: false }),
					h(SyncGroup, {
						group: 'flows',
						rows: ROWS,
						all: ROWS,
						selected: selected.value,
						state: 'none',
						isLocked: () => false,
						onToggle: (row: SyncRow, on: boolean) => {
							const next = new Set(selected.value);
							if (on) next.add(row.id);
							else next.delete(row.id);
							selected.value = next;
						},
					}),
				]),
		}),
		{ global: { plugins: [i18n] }, attachTo: document.body },
	);

	await flushPromises();
	expect(await violations(wrapper.element)).toEqual([]);

	(wrapper.get('[aria-label="Select Nightly"]').element as HTMLElement).focus();
	await userEvent.keyboard(' ');
	await flushPromises();
	expect(selected.value.has('flows/flow:a')).toBe(true);
	expect(wrapper.get('[aria-label="Select Blocked"]').attributes('disabled')).toBeDefined();
});

test('row detail and confirm dialog: no serious axe violation', async () => {
	const detailWrapper = mount(SyncRowDetail, {
		props: { open: true, row: ROWS[1]! },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	const detail = document.body.querySelector('[role="dialog"]')!;
	expect(detail.textContent).toContain('Old');
	expect(await violations(detail)).toEqual([]);
	detailWrapper.unmount();
	await flushPromises();

	mount(SyncConfirmDialog, {
		props: { open: true, rows: ROWS.slice(0, 3) },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	const confirm = document.body.querySelector('[role="dialog"]')!;
	expect(confirm.textContent).toContain('Deletes cannot be undone.');
	expect(await violations(confirm)).toEqual([]);
});
