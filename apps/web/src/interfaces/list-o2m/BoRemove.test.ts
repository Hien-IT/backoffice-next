// Directus has no test for v-remove.vue: icon and label per item state, the confirm dialog for local items with
// edits, and the `action` event.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';
import { i18n } from '../../lang/index.ts';
import BoRemove from './BoRemove.vue';

enableAutoUnmount(afterEach);

const o2m = {
	type: 'o2m',
	relation: { field: 'parent_id' },
	relatedPrimaryKeyField: { field: 'id' },
	sortField: 'sort',
} as unknown as RelationO2M;

function mountRemove(props: Record<string, unknown> = {}) {
	return mount(BoRemove, { props, global: { plugins: [i18n] }, attachTo: document.body });
}

describe('BoRemove', () => {
	test.each([
		[{}, 'delete', 'Remove Item'],
		[{ itemType: 'deleted' }, 'settings_backup_restore', 'Undo Removed Item'],
		[{ deselect: true }, 'close', 'Deselect'],
		[{ itemIsLocal: true }, 'close', 'Deselect'],
	])('icon and label for %o', (props, icon, label) => {
		const button = mountRemove(props).get('button');

		expect(button.attributes('data-icon')).toBe(icon);
		expect(button.attributes('aria-label')).toBe(label);
	});

	test('a click emits action', async () => {
		const wrapper = mountRemove();
		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	test('disabled: no click', async () => {
		const wrapper = mountRemove({ disabled: true });
		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
	});

	test('a local o2m item with edits asks before removing', async () => {
		const wrapper = mountRemove({
			itemInfo: o2m,
			itemIsLocal: true,
			itemType: 'created',
			itemEdits: { name: 'New', $type: 'created', $index: 0 },
		});

		expect(wrapper.get('button').attributes('data-icon')).toBe('delete');
		await wrapper.get('button').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('action')).toBeUndefined();

		const dialog = document.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain('Are you sure you want to delete this item?');

		Array.from(dialog.querySelectorAll('button'))
			.find((b) => b.textContent?.includes('Delete'))!
			.click();
		await flushPromises();
		expect(wrapper.emitted('action')).toHaveLength(1);
	});

	test('confirm prop always asks; Cancel keeps the item', async () => {
		const wrapper = mountRemove({ confirm: true });

		await wrapper.get('button').trigger('click');
		await flushPromises();

		Array.from(document.querySelectorAll('[role="dialog"] button'))
			.find((b) => b.textContent?.includes('Cancel'))!
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await flushPromises();

		expect(wrapper.emitted('action')).toBeUndefined();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});
});
