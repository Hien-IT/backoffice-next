// T030 (FR-004, layout-patterns §9): first render of the collection tree with 300 collections (30 open folders of 10)
// and 100 bookmarks, stores already filled. Time from mount to a settled frame (promises flushed, two animation
// frames); the median of 3 runs must stay under 500 ms. Runs only with PERF=1 (vitest.config.ts).
import type { Preset } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { type Collection, useCollectionsStore } from '../../../stores/collections.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import '../../../styles/index.css';
import { useNavigation } from '../composables/use-navigation.ts';
import ContentNavigation from './ContentNavigation.vue';

const BUDGET_MS = 500;
const RUNS = 3;

function collection(name: string, group: string | null, schema = true): Collection {
	return {
		collection: name,
		name: name.toUpperCase(),
		icon: 'database',
		type: schema ? 'table' : 'alias',
		meta: { collection: name, group, hidden: false, sort: null, collapse: 'open' },
		schema: schema ? { name } : null,
	} as unknown as Collection;
}

const collections: Collection[] = [];

for (let folder = 0; folder < 30; folder++) {
	collections.push(collection(`folder_${folder}`, null, false));
	for (let child = 0; child < 9; child++) collections.push(collection(`c_${folder}_${child}`, `folder_${folder}`));
}

const tables = collections.filter((c) => c.schema);

const bookmarks = Array.from(
	{ length: 100 },
	(_, i) => ({ id: i + 1, collection: tables[i % tables.length]!.collection, bookmark: `Bookmark ${i}` }) as Preset,
);

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

test('300 collections and 100 bookmarks render under 500 ms', async () => {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	await router.push('/content/c_0_0');
	const timings: number[] = [];

	for (let run = 0; run < RUNS; run++) {
		setActivePinia(createPinia());
		useCollectionsStore().collections = collections;
		usePresetsStore().collectionPresets = bookmarks;
		useUserStore().currentUser = { id: 'me', admin_access: true } as never;
		useNavigation().activeGroups.value = collections.map((c) => c.collection);

		const start = performance.now();
		const wrapper = mount(ContentNavigation, { global: { plugins: [i18n, router] }, attachTo: document.body });
		await flushPromises();
		await frame();
		await frame();
		timings.push(performance.now() - start);

		expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(400);
		wrapper.unmount();
	}

	const median = [...timings].sort((a, b) => a - b)[Math.floor(RUNS / 2)]!;
	// eslint-disable-next-line no-console
	console.log(`ContentNavigation 300 collections + 100 bookmarks: ${timings.map((t) => t.toFixed(0)).join(', ')} ms`);
	expect(median).toBeLessThan(BUDGET_MS);
});
