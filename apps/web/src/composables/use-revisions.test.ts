// DR has no test for use-revisions.ts / use-revision.ts: the requests of contracts/api-calls.md #55 and #56
// (count, page of 10 sorted -id, version filter, `created` lookup) and the grouping by date.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { replaceQueue } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { useServerStore } from '../stores/server.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import type { ContentVersionWithType } from '../types/versions.ts';
import { resetNotices, useNotices } from './use-notices.ts';
import { useRevision } from './use-revision.ts';
import { useRevisions } from './use-revisions.ts';

enableAutoUnmount(afterEach);

beforeEach(async () => {
	await replaceQueue();
	setActivePinia(createPinia());
	resetNotices();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 9, 15, 12));
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const user = { id: 'u1', email: 'a@b.c', first_name: 'Ada', last_name: 'L' };

const rows = [
	{
		id: 3,
		collection: 'bo_content',
		item: '1',
		activity: { action: 'update', timestamp: new Date(2026, 9, 15, 9).toISOString(), user },
	},
	{
		id: 2,
		collection: 'bo_content',
		item: '1',
		activity: { action: 'update', timestamp: new Date(2026, 9, 14, 9).toISOString(), user },
	},
	{
		id: 1,
		collection: 'bo_content',
		item: '1',
		activity: { action: 'create', timestamp: new Date(2025, 0, 2, 9).toISOString(), user: null },
	},
];

function api(count = rows.length) {
	return mockApi({
		'GET /revisions': ({ url }: { url: URL }) => {
			if (url.searchParams.has('aggregate')) return json({ data: [{ count: { id: String(count) } }] });
			if (url.searchParams.get('fields') === 'id') return json({ data: [{ id: 1 }] });
			return json({ data: rows });
		},
		'GET /revisions/2': { ...rows[1], data: { title: 'b' }, delta: { title: 'b' } },
	});
}

function withSetup<T>(use: () => T): T {
	let result: T;
	mount(defineComponent({ setup: () => ((result = use()), () => null) }), { global: { plugins: [i18n] } });
	return result!;
}

test('counts, then reads a page of 10 sorted by -id and the created revision', async () => {
	const fetch = api(23);
	const r = withSetup(() => useRevisions(ref('bo_content'), ref(1), ref(null), { full: true }));

	await r.refresh();

	const list = calls(fetch);
	expect(list).toHaveLength(3);
	expect(list[0]).toContain('aggregate={"count":"id"}');
	expect(list[0]).toContain('"version":{"_null":true}');
	expect(list[1]).toContain('sort=-id');
	expect(list[1]).toContain('limit=10');
	expect(list[1]).toContain('activity.user.first_name');
	expect(list[1]).toContain('data,delta');
	expect(list[2]).toContain('"activity":{"action":{"_eq":"create"}}');
	expect(r.revisionsCount.value).toBe(23);
	expect(r.pagesCount.value).toBe(3);
	expect(r.created.value).toEqual({ id: 1 });
});

test('groups the revisions by date: today, yesterday, short date', async () => {
	api();
	const r = withSetup(() => useRevisions(ref('bo_content'), ref(1), ref(null)));

	await r.refresh();

	expect(r.revisionsByDate.value!.map((g) => g.dateFormatted)).toEqual(['Today', 'Yesterday', 'Jan 2, 2025']);
	expect(r.revisionsByDate.value![0]!.revisions[0]!.id).toBe(3);
	expect(r.revisions.value!.map((rev) => rev.id)).toEqual([3, 2, 1]);
});

test('filters on the version and looks for the version_save revision; the page size follows queryLimit.max', async () => {
	const fetch = api();
	useServerStore().info.queryLimit = { default: 100, max: 5 };
	const version = ref<ContentVersionWithType | null>({ id: 'v1' } as ContentVersionWithType);
	const r = withSetup(() => useRevisions(ref('bo_content'), ref(1), version, { action: 'update' }));

	await r.refresh(2);

	const list = calls(fetch);
	expect(list[0]).toContain('{"version":{"_eq":"v1"}},{"activity":{"action":{"_eq":"update"}}}');
	expect(list[1]).toContain('limit=5');
	expect(list[1]).toContain('page=2');
	expect(list[2]).toContain('"activity":{"action":{"_eq":"version_save"}}');
});

test('refreshes when the version changes', async () => {
	const fetch = api();
	const version = ref<ContentVersionWithType | null>(null);
	withSetup(() => useRevisions(ref('bo_content'), ref(1), version));

	version.value = { id: 'v2' } as ContentVersionWithType;
	await nextTick();
	await vi.waitFor(() => expect(calls(fetch).length).toBeGreaterThanOrEqual(2));
	expect(calls(fetch)[0]).toContain('"_eq":"v2"');
});

test('an error opens the error dialog', async () => {
	mockApi({});
	const r = withSetup(() => useRevisions(ref('bo_content'), ref(1), ref(null)));

	await r.getRevisionsCount();

	expect(useNotices().dialogs.value).toHaveLength(1);
	expect(r.loadingCount.value).toBe(false);
});

test('useRevision reads one revision with data and delta', async () => {
	const fetch = api();
	const id = ref<number | undefined>(undefined);
	const r = withSetup(() => useRevision(id));

	id.value = 2;
	await vi.waitFor(() => expect(r.revision.value?.id).toBe(2));

	expect(calls(fetch)[0]).toMatch(/^GET \/revisions\/2\?fields=id,data,delta,collection,item,activity\.action/);
	expect(r.revision.value!.delta).toEqual({ title: 'b' });
	expect(r.revision.value!.timestampFormatted).toBe('Oct 14, 2026 (9:00:00 AM)');
});
