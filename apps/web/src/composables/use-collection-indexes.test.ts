// Backoffice (spec 030, T051, T058): the requests, the 404 probe, the shared store, the 5 s poll and the toasts of
// the Indexes card.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { effectScope } from 'vue';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { type CollectionIndex, _resetCollectionIndexes, POLL_MS, useCollectionIndexes } from './use-collection-indexes.ts';
import { notify } from './use-notices.ts';

vi.mock('./use-notices.ts', () => ({ notify: vi.fn() }));

const row = (over: Partial<CollectionIndex> = {}): CollectionIndex => ({
	id: 'i1',
	collection: 'articles',
	name: 'articles_a_b_unique',
	fields: ['a', 'b'],
	type: 'btree',
	unique: true,
	status: 'ready',
	error: null,
	date_created: '2026-11-03T00:00:00.000Z',
	missing: false,
	...over,
});

const PATH = '/backoffice/collections/articles/indexes';
const listing = (data: CollectionIndex[], meta = { trigram: true, concurrent: true }) => () => json({ data, meta });

beforeEach(() => {
	setActivePinia(createPinia());
	_resetCollectionIndexes();
	vi.mocked(notify).mockClear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('GET 404 (DR) and 403 make the store unavailable without an error', async () => {
	mockApi({});
	const api = useCollectionIndexes('articles');
	await api.load();
	expect(api.available.value).toBe(false);
	expect(api.error.value).toBeNull();

	mockApi({ [`GET ${PATH}`]: () => json({ errors: [] }, 403) });
	await api.load();
	expect(api.available.value).toBe(false);
});

test('GET 200: rows and meta; create posts the body (with ?concurrentIndexCreation=false when off); remove deletes', async () => {
	const created = row({ id: 'i2', name: 'articles_c_index', fields: ['c'], unique: false, status: 'creating' });
	const fetch = mockApi({
		[`GET ${PATH}`]: listing([row()]),
		[`POST ${PATH}`]: created,
		[`DELETE ${PATH}/articles_a_b_unique`]: () => new Response(null, { status: 204 }),
	});
	const api = useCollectionIndexes(() => 'articles');

	await api.load();
	expect(api.available.value).toBe(true);
	expect(api.indexes.value.map((r) => r.name)).toEqual(['articles_a_b_unique']);
	expect(api.meta.value).toEqual({ trigram: true, concurrent: true });
	expect(api.indexesOf('a').map((r) => r.name)).toEqual(['articles_a_b_unique']);
	expect(api.indexesOf('z')).toEqual([]);

	const result = await api.create({ fields: ['c'], type: 'btree', unique: false }, false);
	expect(result.name).toBe('articles_c_index');
	expect(api.indexes.value).toHaveLength(2);
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('articles_c_index') }));
	const post = calls(fetch).find((c) => c.startsWith('POST'));
	expect(post).toBe(`POST ${PATH}?concurrentIndexCreation=false`);

	await api.remove('articles_a_b_unique');
	expect(api.indexes.value.map((r) => r.name)).toEqual(['articles_c_index']);
	expect(calls(fetch)).toContain(`DELETE ${PATH}/articles_a_b_unique`);
	// Shared store: another caller sees the same rows.
	expect(useCollectionIndexes('articles').indexes.value).toHaveLength(1);
});

test('polls every 5 s while a row is creating, toasts the outcome, stops when none is left or the scope ends', async () => {
	vi.useFakeTimers();
	let status: CollectionIndex['status'] = 'creating';
	const fetch = mockApi({ [`GET ${PATH}`]: () => json({ data: [row({ status, error: status === 'failed' ? 'boom' : null })], meta: {} }) });

	const scope = effectScope();
	const api = scope.run(() => useCollectionIndexes('articles'))!;
	await api.load();
	expect(calls(fetch)).toHaveLength(1);

	await vi.advanceTimersByTimeAsync(POLL_MS);
	expect(calls(fetch)).toHaveLength(2);

	status = 'ready';
	await vi.advanceTimersByTimeAsync(POLL_MS);
	expect(calls(fetch)).toHaveLength(3);
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
	await vi.advanceTimersByTimeAsync(POLL_MS * 2);
	expect(calls(fetch)).toHaveLength(3); // no creating row: no poll

	status = 'creating';
	await api.load();
	await vi.advanceTimersByTimeAsync(POLL_MS);
	expect(calls(fetch)).toHaveLength(5);
	scope.stop();
	await vi.advanceTimersByTimeAsync(POLL_MS * 2);
	expect(calls(fetch)).toHaveLength(5); // nobody watches: no poll

	status = 'failed';
	const api2 = useCollectionIndexes('articles');
	await api2.load();
	expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', title: expect.stringContaining('boom') }));
});
