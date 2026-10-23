// DR has no test for fields-management.vue, FieldSelect.vue or field-select-menu.vue: the order (meta.sort then
// meta.id, no `$` fields), locked system fields first, groups nesting their fields, widths, the sort saved as
// PATCH /fields/:c (optimistic, undone with the error dialog), the D-96 moves, the row menu (hide, width, duplicate,
// delete), a field without meta configured on open, and the create links (spec 016 US2-2 to US2-7, FR-021 to FR-027).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { replaceQueue } from '../../../../../api/sdk.ts';
import { resetNotices, useNotices } from '../../../../../composables/use-notices.ts';
import { i18n } from '../../../../../lang/index.ts';
import { useCollectionsStore } from '../../../../../stores/collections.ts';
import { calls, json, mockApi } from '../../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../../test-utils/layout.ts';
import FieldsManagement from './FieldsManagement.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	resetNotices();
});
beforeEach(() => replaceQueue());

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

const field = (
	name: string,
	type: string,
	meta: Record<string, unknown> | null,
	schema: Record<string, unknown> = {},
) => ({
	collection: 'bo_art',
	field: name,
	type,
	schema: { is_primary_key: false, comment: null, ...schema },
	meta: meta && {
		id: 1,
		collection: 'bo_art',
		field: name,
		sort: null,
		group: null,
		hidden: false,
		width: 'full',
		interface: 'input',
		special: null,
		required: false,
		system: false,
		validation: null,
		...meta,
	},
});

const FIELDS = [
	field('id', 'integer', { id: 1, sort: 1, hidden: true }, { is_primary_key: true }),
	field('title', 'string', {
		id: 2,
		sort: 2,
		width: 'half',
		required: true,
		validation: { _and: [{ title: { _nnull: true } }] },
	}),
	field('body', 'text', { id: 3, sort: 3, width: 'half' }),
	field('seo', 'alias', { id: 4, sort: 4, special: ['alias', 'no-data', 'group'], interface: 'group-raw' }),
	field('seo_title', 'string', { id: 5, sort: 1, group: 'seo' }),
	field('$thumbnail', 'string', { id: 6, sort: 6 }),
	field('data', 'json', null),
	field('owner', 'uuid', { id: 7, sort: 0, system: true }),
];

const routes = [
	{ path: '/settings/data-model/:collection', name: 'settings-fields', component: { render: () => null } },
	{ path: '/settings/data-model/:collection/:field', name: 'settings-fields-field', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function mountGrid(answers: Record<string, unknown> = {}) {
	const fetch = mockApi({ 'GET /fields': FIELDS, 'GET /collections': [], ...answers });
	const mounted = await mountLayout(FieldsManagement, {
		routes,
		path: '/settings/data-model/bo_art',
		props: { collection: 'bo_art' },
		beforeMount() {
			const store = useCollectionsStore();
			store.collections = [store.prepareCollectionForApp({ collection: 'bo_art', schema: {}, meta: {} } as never)];
		},
	});
	return { fetch, ...mounted };
}

const keys = (root: ParentNode = document) =>
	[...root.querySelectorAll('span.font-mono')].map((s) => s.textContent!.trim());

async function openRowMenu(name: string) {
	const trigger = document.querySelector<HTMLElement>(
		`button.row-menu[aria-label="${t('item_options', { item: name })}"]`,
	)!;
	trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
	return [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
}

const byText = (items: HTMLElement[], text: string) => items.find((i) => i.textContent!.includes(text));

async function select(items: HTMLElement[], text: string) {
	byText(items, text)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();
}

const bodies = (fetch: ReturnType<typeof mockApi>, method: string, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));

test('locked system fields first, then meta.sort / meta.id order without $ fields; groups nest their fields', async () => {
	await mountGrid();

	expect(keys()).toEqual(['owner', 'id', 'title', 'body', 'seo', 'seo_title', 'data']);
	expect(document.querySelector('button.row-menu[aria-label*="owner"]')).toBeNull();
	expect(document.body.textContent).not.toContain('$thumbnail');

	const seo = document.querySelector('li[data-row-key="seo"]')!;
	expect(keys(seo)).toEqual(['seo', 'seo_title']);
	expect(document.querySelector('li[data-row-key="title"]')!.className).not.toContain('col-span-2');
	expect(document.querySelector('li[data-row-key="data"]')!.className).toContain('col-span-2');
	expect(document.querySelector('li[data-row-key="data"]')!.textContent).toContain(t('db_only_click_to_configure'));
	expect(document.querySelector('li[data-row-key="id"] [aria-label="' + t('primary_key') + '"]')).not.toBeNull();
});

test('Move down saves the whole list with PATCH /fields/:c; a failed save is undone with the error dialog', async () => {
	const { fetch } = await mountGrid({
		'PATCH /fields/bo_art': () => json({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] }, 403),
	});

	await select(await openRowMenu('title'), t('move_down'));

	expect(bodies(fetch, 'PATCH', '/fields/bo_art')).toEqual([
		[
			{ field: 'id', meta: { sort: 1, group: null } },
			{ field: 'body', meta: { sort: 2, group: null } },
			{ field: 'title', meta: { sort: 3, group: null } },
			{ field: 'seo', meta: { sort: 4, group: null } },
			{ field: 'data', meta: { sort: 5, group: null } },
		],
	]);
	expect(keys().slice(1, 4)).toEqual(['id', 'title', 'body']);
	expect(useNotices().dialogs.value.map((d) => d.code)).toEqual(['FORBIDDEN']);
});

test('Into the group above only below a group; Out of the group goes after the group', async () => {
	const { fetch } = await mountGrid({ 'PATCH /fields/bo_art': [] });

	const titleMenu = await openRowMenu('title');
	expect(byText(titleMenu, t('indent_item'))!.getAttribute('aria-disabled')).toBe('true');
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await flushPromises();

	await select(await openRowMenu('data'), t('indent_item'));
	expect(bodies(fetch, 'PATCH', '/fields/bo_art').at(-1)).toEqual([
		{ field: 'seo_title', meta: { sort: 1, group: 'seo' } },
		{ field: 'data', meta: { sort: 2, group: 'seo' } },
	]);

	await select(await openRowMenu('seo_title'), t('outdent_item'));
	expect(bodies(fetch, 'PATCH', '/fields/bo_art').at(-1)).toEqual([
		{ field: 'id', meta: { sort: 1, group: null } },
		{ field: 'title', meta: { sort: 2, group: null } },
		{ field: 'body', meta: { sort: 3, group: null } },
		{ field: 'seo', meta: { sort: 4, group: null } },
		{ field: 'seo_title', meta: { sort: 5, group: null } },
	]);
});

test('row menu: hide and width send PATCH /fields/:c/:f; delete and widths locked as Directus', async () => {
	const { fetch } = await mountGrid({
		'PATCH /fields/bo_art/body': ({ init }: { init: RequestInit }) =>
			json({ data: { ...FIELDS[2], meta: { ...FIELDS[2]!.meta, ...JSON.parse(String(init.body)).meta } } }),
	});

	const menu = await openRowMenu('body');
	expect(byText(menu, t('half_width'))!.getAttribute('aria-disabled')).toBe('true');
	await select(menu, t('hide_field_on_detail'));
	await select(await openRowMenu('body'), t('full_width'));

	expect(bodies(fetch, 'PATCH', '/fields/bo_art/body')).toEqual([
		{ meta: { hidden: true } },
		{ meta: { width: 'full' } },
	]);

	const idMenu = await openRowMenu('id');
	expect(byText(idMenu, t('delete_field'))!.getAttribute('aria-disabled')).toBe('true');
	expect(byText(idMenu, t('duplicate_field'))!.getAttribute('aria-disabled')).toBe('true');
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	await flushPromises();

	const seoMenu = await openRowMenu('seo');
	expect(byText(seoMenu, t('delete_field'))!.getAttribute('aria-disabled')).toBe('true');
	expect(byText(seoMenu, t('full_width'))!.getAttribute('aria-disabled')).toBe('true');
});

test('duplicate: the copy without id, sort, group, comment and name, validation keys renamed', async () => {
	const { fetch } = await mountGrid({
		'POST /fields/bo_art': ({ init }: { init: RequestInit }) => json({ data: JSON.parse(String(init.body)) }),
	});

	await select(await openRowMenu('title'), t('duplicate_field'));
	const dialog = document.querySelector('[role="dialog"]')!;
	expect(dialog.querySelector<HTMLInputElement>('input.font-mono, input')!.value).toBe('title_copy');

	document.querySelector<HTMLFormElement>('#field-duplicate-form')!.requestSubmit();
	await flushPromises();

	const [body] = bodies(fetch, 'POST', '/fields/bo_art');
	expect(body.field).toBe('title_copy');
	expect(body.name).toBeUndefined();
	expect(body.schema.comment).toBeUndefined();
	expect(body.meta).not.toHaveProperty('id');
	expect(body.meta).not.toHaveProperty('sort');
	expect(body.meta).not.toHaveProperty('group');
	expect(body.meta.validation).toEqual({ _and: [{ title_copy: { _nnull: true } }] });
	expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('delete: the confirm dialog, then DELETE /fields/:c/:f', async () => {
	const { fetch } = await mountGrid({ 'DELETE /fields/bo_art/body': () => new Response(null, { status: 204 }) });

	await select(await openRowMenu('body'), t('delete_field'));
	const dialog = document.querySelector('[role="dialog"]')!;
	expect(dialog.textContent).toContain(t('delete_field_are_you_sure', { field: 'body' }));
	[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_label'))!.click();
	await flushPromises();

	expect(calls(fetch)).toContain('DELETE /fields/bo_art/body');
	expect(keys()).not.toContain('body');
});

test('a field without meta gets its special before the drawer opens; the create links', async () => {
	const { fetch, router } = await mountGrid({ 'PATCH /fields/bo_art/data': FIELDS[6] });

	document.querySelector<HTMLButtonElement>('li[data-row-key="data"] button[title]')!.click();
	await flushPromises();

	expect(bodies(fetch, 'PATCH', '/fields/bo_art/data')).toEqual([{ meta: { special: ['cast-json'] } }]);
	expect(router.currentRoute.value.fullPath).toBe('/settings/data-model/bo_art/data');

	expect(document.querySelector('a[href="/settings/data-model/bo_art/+"]')!.textContent).toContain(t('create_field'));
	[...document.querySelectorAll('button')]
		.find((b) => b.textContent?.trim() === t('create_in_advanced_field_creation_mode'))!
		.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	await flushPromises();

	const links = [...document.querySelectorAll('[role="menuitem"]')].map((a) => a.getAttribute('href'));
	expect(links).toEqual(
		['standard', 'presentation', 'group', 'file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'translations'].map(
			(type) => `/settings/data-model/bo_art/+?type=${type}`,
		),
	);
	expect(document.querySelectorAll('[role="menu"] [role="separator"]')).toHaveLength(3);
});
