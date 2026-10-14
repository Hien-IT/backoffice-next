// T095 (SC-004, contracts/tests.md §6): first render of BoForm with 50 fields of the fixture's standard interfaces and
// of BoTable with 100 rows × 10 display columns, data already in memory (stores hydrated and values read from the mock
// API before timing). Time from mount to a settled frame (promises flushed, nextTick, two animation frames); the
// median of 3 runs must stay under 1 000 ms. The numbers are printed for the CI log.
import { readItem } from '@directus/sdk';
import type { Field } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
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
import BoTable from '../BoTable.vue';
import RenderDisplay from '../render/RenderDisplay.vue';
import BoForm from './BoForm.vue';

const BUDGET_MS = 1000;
const RUNS = 3;

// Third-party editors and maps load their library lazily and are measured by their own tests, not here.
const NOT_STANDARD = /^(map|input-code|input-rich-text-|input-block-editor|system-raw-editor)/;

// Ten displays of bo_std that render from the row value alone.
const DISPLAY_FIELDS = [
	'input_string', // formatted-value
	'input_default', // raw
	'input_hash', // hash
	'boolean', // boolean
	'date', // datetime
	'slider', // rating
	'tags', // labels
	'select_icon', // icon
	'select_color', // color
	'filesize', // filesize
];

const snapshot = loadSnapshot();
const item = snapshot.items['bo_std']![0]!;
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

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

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Mounts, waits for a settled frame, unmounts; returns the elapsed milliseconds. */
async function timeFirstRender(render: () => ReturnType<typeof mount>, check: () => void): Promise<number> {
	const start = performance.now();
	const wrapper = render();
	await flushPromises();
	await nextTick();
	await frame();
	await frame();
	const elapsed = performance.now() - start;

	check();
	wrapper.unmount();
	return elapsed;
}

async function median(label: string, render: () => ReturnType<typeof mount>, check: () => void) {
	const runs: number[] = [];
	for (let run = 0; run < RUNS; run++) runs.push(await timeFirstRender(render, check));

	const sorted = [...runs].sort((a, b) => a - b);
	const middle = sorted[Math.floor(RUNS / 2)]!;
	// eslint-disable-next-line no-console
	console.log(`SC-004 ${label}: runs ${runs.map((ms) => ms.toFixed(1)).join(', ')} ms, median ${middle.toFixed(1)} ms`);
	return middle;
}

test('BoForm with 50 fields of standard interfaces renders in under 1 s (median of 3)', async () => {
	const standard = useFieldsStore()
		.getFieldsForCollection('bo_std')
		.filter((field) => !field.meta?.hidden && !NOT_STANDARD.test(field.meta?.interface ?? ''));

	// The fixture fields, repeated under new names when there are fewer than 50.
	const fields: Field[] = [];
	const values: Record<string, unknown> = {};

	for (let index = 0; fields.length < 50; index++) {
		const source = standard[index % standard.length]!;
		const name = index < standard.length ? source.field : `${source.field}_${index}`;
		fields.push({ ...source, field: name, meta: { ...source.meta!, field: name, sort: index + 1, group: null } });
		values[name] = item[source.field];
	}

	expect(new Set(fields.map((field) => field.meta?.interface)).size).toBeGreaterThan(15);

	const elapsed = await median(
		'BoForm 50 fields',
		() =>
			mount(BoForm, {
				props: { fields, primaryKey: item['id'] as number, initialValues: values, modelValue: {} },
				global: { plugins: [i18n, router] },
				attachTo: document.body,
			}),
		() => expect(document.querySelectorAll('[data-field]')).toHaveLength(50),
	);

	expect(elapsed).toBeLessThan(BUDGET_MS);
});

test('BoTable with 100 rows × 10 display columns renders in under 1 s (median of 3)', async () => {
	const fields = DISPLAY_FIELDS.map((name) => snapshot.fields.find((f) => f.collection === 'bo_std' && f.field === name)!);
	const seeded = (await sdk.request(
		readItem('bo_std' as never, item['id'] as never, {
			fields: adjustFieldsForDisplays(DISPLAY_FIELDS, 'bo_std'),
		} as never),
	)) as Record<string, unknown>;
	const rows = Array.from({ length: 100 }, (_, index) => ({ ...seeded, id: index + 1 }));

	expect(new Set(fields.map((field) => field.meta?.display)).size).toBe(10);

	const elapsed = await median(
		'BoTable 100x10',
		() =>
			mount(BoTable, {
				props: { columns: fields.map((field) => ({ key: field.field, label: field.field })), rows },
				slots: Object.fromEntries(
					fields.map((field) => [
						`item.${field.field}`,
						// typed loosely: BoTable's slot record also types the header.* slots
						(props: Record<string, any>) =>
							h(RenderDisplay, {
								display: field.meta!.display!,
								options: field.meta!.display_options,
								interface: field.meta!.interface,
								interfaceOptions: field.meta!.options,
								value: props['item'][field.field],
								type: field.type,
								collection: field.collection,
								field: field.field,
							}),
					]),
				),
				global: { plugins: [i18n, router] },
				attachTo: document.body,
			}),
		() => expect(document.querySelectorAll('tbody tr')).toHaveLength(100),
	);

	expect(elapsed).toBeLessThan(BUDGET_MS);
});
