// Directus has no test for field-detail.vue: the simple mode (interface cards as a radiogroup, the configuration
// panel, save), the request sequence of an m2m field compared with what the Directus app sent (baseline of T003),
// the advanced mode tabs by local type, and D-97 (a missing field or an unknown ?type= goes back with the error dialog).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView } from 'vue-router';
import { replaceQueue } from '../../../../../api/sdk.ts';
import { resetNotices, useNotices } from '../../../../../composables/use-notices.ts';
import { i18n } from '../../../../../lang/index.ts';
import { useCollectionsStore } from '../../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../../stores/fields.ts';
import { json, mockApi } from '../../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../../test-utils/layout.ts';
import FieldDetail from './FieldDetail.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
	resetNotices();
	replaceQueue();
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
	readFileSync(join(here, '../../../../../../../web-e2e/src/payload/baselines/settings-field-m2m.json'), 'utf8'),
) as { method: string; path: string; body: unknown }[];

const COLLECTION = 'bo_t003_col';

const routes = [
	{ path: '/settings/data-model/:collection', name: 'settings-fields', component: { render: () => null } },
	{
		path: '/settings/data-model/:collection/:field',
		name: 'settings-fields-field',
		component: FieldDetail,
		props: (route: any) => ({
			collection: route.params.collection,
			field: route.params.field,
			type: route.query.type ?? null,
		}),
	},
];

const echo = ({ init }: { init: RequestInit }) => json({ data: JSON.parse(String(init.body)) });

async function open(path: string) {
	const fetch = mockApi({
		'POST /fields/bo_t003_col': echo,
		'POST /fields/bo_t003_col_bo_t003_tag': echo,
		'POST /collections': echo,
		'POST /relations': echo,
		'GET /fields': [],
		[`GET /fields/${COLLECTION}/title`]: {},
	});
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path,
			beforeMount() {
				const collections = useCollectionsStore();
				collections.collections = [
					collections.prepareCollectionForApp({ collection: COLLECTION, schema: {}, meta: {} } as never),
				];
				useFieldsStore().fields = [
					{
						collection: COLLECTION,
						field: 'id',
						name: 'ID',
						type: 'integer',
						schema: { is_primary_key: true, has_auto_increment: true },
						meta: { id: 1, interface: 'input', special: null, hidden: true },
					},
					{
						collection: COLLECTION,
						field: 'title',
						name: 'Title',
						type: 'string',
						schema: { is_primary_key: false },
						meta: { id: 2, interface: 'input', special: null },
					},
				] as never;
			},
		},
	);
	await flushPromises();
	return { fetch, ...mounted };
}

const writes = (fetch: ReturnType<typeof mockApi>) =>
	fetch.mock.calls
		.filter(([, init]) => init?.method && init.method !== 'GET')
		.map(([input, init]) => ({
			method: init!.method,
			path: new URL(String(input)).pathname,
			body: JSON.parse(String(init!.body)),
		}));

/** Recursively sorts object keys, so bodies compare whatever order the app built them in. */
const sorted = (value: unknown): unknown =>
	Array.isArray(value)
		? value.map(sorted)
		: value && typeof value === 'object'
			? Object.fromEntries(
					Object.entries(value)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, v]) => [k, sorted(v)]),
				)
			: value;

test('simple mode: an m2m field sends the requests of the Directus app, in its order', async () => {
	const { fetch, router } = await open(`/settings/data-model/${COLLECTION}/+`);

	expect(document.querySelector('[role="dialog"]')!.textContent).toContain(
		t('creating_new_field', { collection: COLLECTION }),
	);
	const card = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((radio) =>
		radio.textContent?.includes(t('interfaces.list-m2m.many-to-many')),
	)!;
	card.click();
	await flushPromises();

	const key = document.querySelector<HTMLInputElement>(`[role="dialog"] input[aria-label="${t('key')}"]`)!;
	key.value = 'tags';
	key.dispatchEvent(new Event('input'));
	await flushPromises();

	const related = document.querySelector<HTMLInputElement>(`[role="dialog"] input[aria-label="${t('collection')}"]`)!;
	related.value = 'bo_t003_tag';
	related.dispatchEvent(new Event('input'));
	await flushPromises();

	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
		.find((b) => b.textContent?.trim() === t('save'))!
		.click();
	await flushPromises();

	expect(sorted(writes(fetch))).toEqual(sorted(baseline));
	expect(router.currentRoute.value.name).toBe('settings-fields');
});

test('advanced mode: the tabs of an m2m field; an existing field opens advanced', async () => {
	await open(`/settings/data-model/${COLLECTION}/+?type=m2m`);

	const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
	expect(tabs).toEqual([
		t('schema'),
		t('relationship'),
		t('field', 1),
		t('interface_label'),
		t('display'),
		t('validation'),
		t('conditions'),
	]);
	expect(document.querySelector(`button[aria-label="${t('save')}"]`)!.hasAttribute('disabled')).toBe(true);
});

test('advanced mode from 1024px (D-167): the tab content on the page tint, the tab list white, the drawer 5xl wide', async () => {
	const matchMedia = window.matchMedia;
	window.matchMedia = ((query: string) => ({
		matches: query.includes('min-width: 1024px'),
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as never;

	try {
		await open(`/settings/data-model/${COLLECTION}/+?type=m2m`);

		const panel = document.querySelector('[role="tabpanel"]')!;
		expect(panel.className).toContain('bg-(--project-tint)');
		expect(panel.className).toContain('overflow-y-auto');
		expect(document.querySelector('[role="tablist"]')!.className).not.toContain('project-tint');
		expect(document.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe('vertical');
		expect(document.querySelector('.bo-drawer')!.className).toContain('max-w-5xl');
	} finally {
		window.matchMedia = matchMedia;
	}
});

test.each([
	['a field that does not exist', `/settings/data-model/${COLLECTION}/nope`],
	['an unknown ?type=', `/settings/data-model/${COLLECTION}/+?type=weird`],
])('D-97: %s shows the error dialog and goes back to the collection page', async (_name, path) => {
	const { router } = await open(path);

	expect(useNotices().dialogs.value).toHaveLength(1);
	expect(router.currentRoute.value.fullPath).toBe(`/settings/data-model/${COLLECTION}`);
});

test.each(['standard', 'file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'presentation', 'translations', 'group'])(
	'advanced mode, %s: every tab renders',
	async (type) => {
		const errors: unknown[] = [];
		const { wrapper } = await open(`/settings/data-model/${COLLECTION}/+?type=${type}`);
		wrapper.vm.$.appContext.config.errorHandler = (error: unknown) => void errors.push(error);

		for (const tab of [...document.querySelectorAll<HTMLElement>('[role="tab"]')]) {
			tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			await flushPromises();
			expect(tab.getAttribute('aria-selected'), tab.textContent!).toBe('true');
			expect(
				document.querySelector('[role="tabpanel"]:not([hidden])')!.children.length,
				tab.textContent!,
			).toBeGreaterThan(0);
		}

		expect(errors).toEqual([]);
	},
	15_000,
);
