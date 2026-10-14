// Ported from directus/app/src/views/private/components/drawer-batch.test.ts
// Backoffice: only the stageOnSave case is ported; the PATCH / translations-merge cases test the direct save, which
// DrawerBatch does not have (writes outside FR-054, 014). The form cases run on bo_rel_target of the fixture snapshot.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import DrawerBatch from './DrawerBatch.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;

beforeEach(async () => {
	vi.unstubAllGlobals();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate()]);
	hydrateCalls = fetch.mock.calls.length;
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

async function mountDrawerBatch(props: Record<string, any> = {}) {
	const wrapper = mount(DrawerBatch, {
		props: {
			collection: 'bo_rel_target',
			primaryKeys: [1, 2],
			active: true,
			...props,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	await flushPromises();
	return wrapper;
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;

describe('stageOnSave with translations', () => {
	it('emits raw edits without translations merging when stageOnSave is true', async () => {
		const wrapper = await mountDrawerBatch({
			primaryKeys: [1],
			stageOnSave: true,
			edits: {
				translations: { create: [{ languages_code: 'en', title: 'New' }] },
			},
		});

		await (wrapper.vm as any).save();

		expect(calls(fetch).slice(hydrateCalls)).toEqual([]);

		const emitted = wrapper.emitted('input');
		expect(emitted).toBeTruthy();

		expect(emitted![0]![0]).toEqual({
			translations: { create: [{ languages_code: 'en', title: 'New' }] },
		});
	});
});

describe('batch form', () => {
	it('title with the count, every field starts inactive; activating a field and saving stages its value', async () => {
		const wrapper = await mountDrawerBatch();

		expect(panel().querySelector('h2')!.textContent).toContain('Batch Editing 2 Items');

		const name = () => panel().querySelector<HTMLElement>('[data-field="name"]')!;
		expect(name().querySelector('input')!.disabled).toBe(true);

		name().querySelector<HTMLElement>('[role="checkbox"]')!.click();
		await flushPromises();

		const input = name().querySelector<HTMLInputElement>('input')!;
		expect(input.disabled).toBe(false);
		input.value = 'Same name';
		input.dispatchEvent(new Event('input'));
		await flushPromises();

		panel().querySelector<HTMLButtonElement>('header button[aria-label="Save"]')!.click();
		await flushPromises();

		expect(wrapper.emitted('input')).toEqual([[{ name: 'Same name' }]]);
		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(calls(fetch).slice(hydrateCalls)).toEqual([]);
	});

	it('cancel (Esc) closes without input and drops the local edits', async () => {
		const wrapper = await mountDrawerBatch({ edits: { status: 'draft' } });

		panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await flushPromises();

		expect(wrapper.emitted('update:active')).toEqual([[false]]);
		expect(wrapper.emitted('input')).toBeUndefined();
	});
});
