// DR has no test for use-relation-single.ts: the m2o value shapes of FR-040 (key, object, null) and the display
// item read on the fixture API (contracts/api-calls.md).
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { useRelationM2O } from './use-relation-m2o.ts';
import { useRelationSingle } from './use-relation-single.ts';

let fetch: ReturnType<typeof mockFixtureApi>;

const forbidden = () => json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403);

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot(), { answers: { 'GET /items/bo_rel_target/7': forbidden } });
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	fetch.mockClear();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

function use(initial: number | string | Record<string, any> | null, enabled: () => boolean = () => true) {
	const value = ref(initial);
	const { relationInfo } = useRelationM2O(ref('bo_rel'), ref('m2o'));
	return { value, ...useRelationSingle(value, ref({ fields: ['name'] }), relationInfo, { enabled }) };
}

test('a key reads the related item with the preview fields and the primary key', async () => {
	const { displayItem, loading } = use(1);
	expect(loading.value).toBe(true);
	await flushPromises();

	expect(displayItem.value).toEqual({ name: 'Target one', id: 1 });
	expect(loading.value).toBe(false);
	expect(calls(fetch)).toEqual(['GET /items/bo_rel_target/1?fields=name,id']);
});

test('an edited existing item is merged over the read item', async () => {
	const { displayItem } = use({ id: 2, name: 'Edited' });
	await flushPromises();

	expect(displayItem.value).toEqual({ id: 2, name: 'Edited' });
	expect(calls(fetch)).toEqual(['GET /items/bo_rel_target/2?fields=name,id']);
});

test('a new item (object without key) is shown as is, without a request', async () => {
	const { displayItem } = use({ name: 'New' });
	await flushPromises();

	expect(displayItem.value).toEqual({ name: 'New' });
	expect(calls(fetch)).toEqual([]);
});

test('null clears the display item; enabled false sends nothing', async () => {
	const { value, displayItem } = use(1, () => false);
	await flushPromises();
	expect(displayItem.value).toBeNull();
	expect(calls(fetch)).toEqual([]);

	const single = use(1);
	await flushPromises();
	single.value.value = null;
	await flushPromises();
	expect(single.displayItem.value).toBeNull();
	expect(value.value).toBe(1);
});

test('update keeps the existing primary key in the changes; remove sets null', async () => {
	const { value, update, remove } = use(1);
	await flushPromises();

	update({ name: 'Renamed' });
	expect(value.value).toEqual({ name: 'Renamed', id: 1 });

	update(3);
	expect(value.value).toBe(3);

	remove();
	expect(value.value).toBeNull();
});

test('403 on an object value (manual primary key) shows the value; on a key it warns and sets error', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

	const manual = use({ id: 7, name: 'Manual' });
	await flushPromises();
	expect(manual.displayItem.value).toEqual({ id: 7, name: 'Manual' });
	expect(manual.error.value).toBeNull();
	expect(warn).not.toHaveBeenCalled();

	const key = use(7);
	await flushPromises();
	expect(key.displayItem.value).toBeNull();
	expect(key.loading.value).toBe(false);
	expect(warn).toHaveBeenCalledTimes(1);
	expect(key.error.value).toMatchObject({ errors: [{ extensions: { code: 'FORBIDDEN' } }] });

	key.value.value = 1;
	await flushPromises();
	expect(key.error.value).toBeNull();
});

test('refresh reads the item again', async () => {
	const { refresh } = use(1);
	await flushPromises();
	await refresh();

	expect(calls(fetch)).toEqual([
		'GET /items/bo_rel_target/1?fields=name,id',
		'GET /items/bo_rel_target/1?fields=name,id',
	]);
});
