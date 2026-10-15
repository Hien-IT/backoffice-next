// Directus has no test for import-error-dialog.vue: the import error list (FR-090, recipe Q-12).
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import ImportErrorDialog from './ImportErrorDialog.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		{ collection: 'bo_content', field: 'title', name: 'Title', type: 'string', meta: { required: true } } as Field,
		{ collection: 'bo_content', field: 'status', name: 'Status', type: 'string', meta: null } as Field,
	];
});

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

function setup(errors: unknown[]) {
	return mount(ImportErrorDialog, {
		props: { modelValue: true, errors: errors as never, collection: 'bo_content' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
}

test('lists validation errors with their rows and field, and other errors by code', async () => {
	setup([
		{
			extensions: {
				code: 'FAILED_VALIDATION',
				field: 'title',
				type: 'nnull',
				rows: [
					{ type: 'lines', rows: [2, 3] },
					{ type: 'range', start: 7, end: 9 },
				],
			},
		},
		{ extensions: { code: 'RECORD_NOT_UNIQUE', field: 'status', rows: [{ type: 'lines', rows: [4] }] } },
		{ extensions: { code: 'INVALID_PAYLOAD', rows: [] } },
	]);
	await flushPromises();

	expect(dialog()!.querySelector('h2')!.textContent).toBe('Import Error');
	expect(dialog()!.textContent).toContain('The following rows have invalid values:');

	const items = [...dialog()!.querySelectorAll('li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
	expect(items).toHaveLength(3);
	expect(items[0]).toMatch(/^Row 2, 3, 7–9 \(Title\): /);
	expect(items[1]).toMatch(/^Row 4 \(Status\): /);
	expect(items[2]).not.toMatch(/^Row/);
	expect(items[2]).toBe(i18n.global.t('errors.INVALID_PAYLOAD'));
});

test('dismiss closes the dialog', async () => {
	const wrapper = setup([]);
	await flushPromises();

	[...dialog()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Dismiss')!.click();
	await flushPromises();
	expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
});
