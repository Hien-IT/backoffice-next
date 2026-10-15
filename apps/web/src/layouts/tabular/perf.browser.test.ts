// T035 (SC-011, FR-033): the tabular layout with 1 000 rows × 10 display columns (bo_std displays, data already in
// memory) renders in under 2 s, and scrolling the table 10 times re-renders nothing (no DOM mutation in the body: the
// rows are not redrawn on scroll; the table is not virtualised, as Directus). Runs with PERF=1 only (vitest.config.ts).
import { readItem } from '@directus/sdk';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getDefaultDisplayForType } from '../../utils/get-default-display-for-type.ts';
import Tabular from './Tabular.vue';
import type { HeaderRaw } from './types.ts';

enableAutoUnmount(afterEach);

const BUDGET_MS = 2000;

// The ten displays of bo_std of the 013 perf test (src/components/form/perf.browser.test.ts).
const DISPLAY_FIELDS = [
	'input_string',
	'input_default',
	'input_hash',
	'boolean',
	'date',
	'slider',
	'tags',
	'select_icon',
	'select_color',
	'filesize',
];

const snapshot = loadSnapshot();
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	mockFixtureApi(snapshot);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

test('1 000 rows × 10 columns render in under 2 s; 10 scrolls redraw no row', async () => {
	const fieldsStore = useFieldsStore();
	const item = snapshot.items['bo_std']![0]!;
	const seeded = (await sdk.request(
		readItem(
			'bo_std' as never,
			item['id'] as never,
			{ fields: adjustFieldsForDisplays(DISPLAY_FIELDS, 'bo_std') } as never,
		),
	)) as Record<string, unknown>;
	const items = Array.from({ length: 1000 }, (_, index) => ({ ...seeded, id: index + 1 }));

	// Headers as tabular/index.ts useTable builds them.
	const tableHeaders: HeaderRaw[] = DISPLAY_FIELDS.map((key) => {
		const field = fieldsStore.getField('bo_std', key)!;
		return {
			text: field.name,
			value: key,
			description: null,
			width: 144,
			align: 'left',
			sortable: true,
			field: {
				display: field.meta?.display || getDefaultDisplayForType(field.type),
				displayOptions: field.meta?.display_options,
				interface: field.meta?.interface,
				interfaceOptions: field.meta?.options,
				type: field.type,
				field: field.field,
				collection: field.collection,
			},
		};
	});

	const start = performance.now();

	mount(
		{
			render: () =>
				h('div', { style: 'height: 800px; display: flex; flex-direction: column' }, [
					h(Tabular, {
						collection: 'bo_std',
						readonly: false,
						showSelect: 'multiple',
						tableHeaders,
						items,
						loading: false,
						loadingItemCount: false,
						totalPages: 1,
						tableSort: { by: 'id', desc: false },
						onRowClick: () => undefined,
						tableRowHeight: 43,
						page: 1,
						toPage: () => undefined,
						itemCount: 1000,
						fields: DISPLAY_FIELDS,
						limit: 1000,
						primaryKeyField: fieldsStore.getField('bo_std', 'id'),
						changeManualSort: async () => undefined,
						resetPresetAndRefresh: async () => undefined,
						selectAll: () => undefined,
						onSortChange: () => undefined,
					}),
				]),
		},
		{ global: { plugins: [i18n, router] }, attachTo: document.body },
	);

	await flushPromises();
	await nextTick();
	await frame();
	await frame();
	const elapsed = performance.now() - start;

	// eslint-disable-next-line no-console
	console.log(`SC-011 tabular 1000x10: ${elapsed.toFixed(1)} ms`);
	expect(document.querySelectorAll('tbody tr')).toHaveLength(1000);
	expect(elapsed).toBeLessThan(BUDGET_MS);

	const body = document.querySelector('tbody')!;
	const scroller = document.querySelector<HTMLElement>('[data-fixed-header]')!;
	let mutations = 0;
	const observer = new MutationObserver((records) => (mutations += records.length));
	observer.observe(body, { subtree: true, childList: true, attributes: true, characterData: true });

	for (let step = 1; step <= 10; step++) {
		scroller.scrollTop = step * 2000;
		await frame();
	}

	await flushPromises();
	observer.disconnect();
	expect(scroller.scrollTop).toBeGreaterThan(0);
	expect(mutations).toBe(0);
});
