// DR has no test for new-collection.vue: the two steps, Enter, the db-safe key, the singleton lock on `sort`, the
// POST /collections body per primary key type, the two POST /relations and router.replace (spec 016 US1-8, FR-014).
// The body with every system field is compared with what the DR app sent (baseline recorded by T003).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoSelect from '../../../../components/BoSelect.vue';
import { i18n } from '../../../../lang/index.ts';
import { calls, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import NewCollection from './NewCollection.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => replaceQueue());

const t = (key: string) => i18n.global.t(key);
const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
	readFileSync(join(here, '../../../../../../web-e2e/src/payload/baselines/settings-collection.json'), 'utf8'),
) as { method: string; path: string; body: Record<string, any> }[];

const routes = [
	{ path: '/settings/data-model', name: 'settings-collections', component: { render: () => null } },
	{ path: '/settings/data-model/+', name: 'settings-add-new', component: { render: () => null } },
	{ path: '/settings/data-model/:collection', name: 'settings-fields', component: { render: () => null } },
];

async function mountDrawer() {
	const fetch = mockApi({
		'POST /collections': ({ init }: { init: RequestInit }) =>
			new Response(JSON.stringify({ data: { collection: JSON.parse(String(init.body)).collection } }), {
				headers: { 'Content-Type': 'application/json' },
			}),
		'POST /relations': {},
		'GET /collections': [],
		'GET /fields': [],
		'GET /relations': [],
	});

	const mounted = await mountLayout(NewCollection, { routes, path: '/settings/data-model/+' });
	return { fetch, ...mounted };
}

const nameInput = () => document.querySelector<HTMLInputElement>('#new-collection-name')!;
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

async function type(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input'));
	await flushPromises();
}

async function submit() {
	document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit();
	await flushPromises();
}

const bodies = (fetch: ReturnType<typeof mockApi>, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === 'POST' && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));

/** Turns every optional system field on (step 2). */
async function enableAll() {
	for (const box of document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button[role="checkbox"]')) {
		if (box.getAttribute('aria-checked') !== 'true') box.click();
	}
	await flushPromises();
}

test('step 1 needs a db-safe name; Enter goes to step 2', async () => {
	await mountDrawer();

	expect(button(t('next')).disabled).toBe(true);
	await submit();
	expect(document.querySelector('#new-collection-status')).toBeNull();

	await type(nameInput(), 'Bài viết 1');
	expect(nameInput().value).toBe('Bai_viet_1');
	expect(button(t('next')).disabled).toBe(false);

	await submit();
	expect(document.querySelector('#new-collection-status')).not.toBeNull();
	expect(button(t('finish_setup'))).not.toBeNull();
});

test('the body with every system field and the two relations are the Directus ones, then router.replace', async () => {
	const { fetch, router } = await mountDrawer();
	const replace = vi.spyOn(router, 'replace');

	await type(nameInput(), 'bo_t003_col');
	await submit();
	await enableAll();
	button(t('finish_setup')).click();
	await flushPromises();

	const [collection, ...relations] = baseline;
	expect(bodies(fetch, '/collections')).toEqual([collection!.body]);
	expect(bodies(fetch, '/relations')).toEqual(relations.map((r) => r.body));
	expect(
		calls(fetch)
			.filter((c) => c.startsWith('GET'))
			.sort(),
	).toEqual(['GET /collections', 'GET /fields', 'GET /relations']);
	expect(replace).toHaveBeenCalledWith({ name: 'settings-fields', params: { collection: 'bo_t003_col' } });
	expect(router.currentRoute.value.fullPath).toBe('/settings/data-model/bo_t003_col');
});

test.each([
	[
		'auto_big_int',
		{
			field: 'id',
			type: 'bigInteger',
			meta: { hidden: true, interface: 'input', readonly: true },
			schema: { is_primary_key: true, has_auto_increment: true },
		},
	],
	[
		'uuid',
		{
			field: 'id',
			type: 'uuid',
			meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
			schema: { is_primary_key: true, length: 36, has_auto_increment: false },
		},
	],
	[
		'manual',
		{
			field: 'id',
			type: 'string',
			meta: { interface: 'input', readonly: false, hidden: false },
			schema: { is_primary_key: true, length: 255, has_auto_increment: false },
		},
	],
])('primary key %s: the key field of new-collection.vue, the same system fields', async (pkType, keyField) => {
	const { fetch, wrapper } = await mountDrawer();

	await type(nameInput(), 'bo_t003_col');
	wrapper.findComponent(BoSelect).vm.$emit('update:modelValue', pkType);
	await flushPromises();
	await submit();
	await enableAll();
	button(t('finish_setup')).click();
	await flushPromises();

	const [body] = bodies(fetch, '/collections');
	expect(body.fields[0]).toEqual(keyField);
	expect(body.fields.slice(1)).toEqual(baseline[0]!.body['fields'].slice(1));
});

test('without system fields: no relations, meta fields left out', async () => {
	const { fetch } = await mountDrawer();

	await type(nameInput(), 'bo_plain');
	await submit();
	button(t('finish_setup')).click();
	await flushPromises();

	const [body] = bodies(fetch, '/collections');
	expect(body).toEqual({
		collection: 'bo_plain',
		fields: [baseline[0]!.body['fields'][0]],
		schema: {},
		meta: { singleton: false },
	});
	expect(bodies(fetch, '/relations')).toEqual([]);
});

test('a singleton locks the sort field', async () => {
	const { fetch } = await mountDrawer();

	await type(nameInput(), 'bo_single');
	document.querySelector<HTMLButtonElement>('[role="dialog"] button[role="checkbox"]')!.click();
	await flushPromises();
	await submit();

	const sort = document.querySelector<HTMLInputElement>('#new-collection-sort')!;
	expect(sort.disabled).toBe(true);

	await enableAll();
	button(t('finish_setup')).click();
	await flushPromises();

	const [body] = bodies(fetch, '/collections');
	expect(body.meta.singleton).toBe(true);
	expect(body.fields.map((f: { field: string }) => f.field)).not.toContain('sort');
});
