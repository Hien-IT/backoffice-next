// DR has no test for fields.vue: the collection page header (back, breadcrumb, delete for non-system collections,
// save), the directus_collections form on `edits.meta` (locked for system collections), save and quit, Ctrl/Cmd+S
// save and stay, the unsaved changes dialog with Keep Editing first, delete (spec 016 US2-1, FR-020); the titled card
// of the bo_show_* toggles (spec 022, D-182).
import type { FieldRaw } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { i18n } from '../../../../lang/index.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import FieldsRoute from './FieldsRoute.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

let fetch: ReturnType<typeof mockFixtureApi>;
// Each test hydrates the whole fixture set and mounts BoForm: a loaded CI runner needs more than the 5 s default.
const SLOW = 15_000;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{ path: '/settings/data-model', name: 'settings-collections', component: { render: () => null } },
	// The route component itself, so its leave guard (use-edits-guard) runs.
	{
		path: '/settings/data-model/:collection',
		name: 'settings-fields',
		component: FieldsRoute,
		props: (route) => ({ collection: route.params['collection'] }),
	},
	{ path: '/settings/data-model/:collection/:field', name: 'settings-fields-field', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(collection: string, extraFields: FieldRaw[] = []) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/settings/data-model/${collection}`,
			async beforeMount() {
				const snapshot = loadSnapshot();
				fetch = mockFixtureApi({ ...snapshot, fields: [...snapshot.fields, ...extraFields] }, { user: 'admin' });
				await useUserStore().hydrate();
				await Promise.all([
					useFieldsStore().hydrate(),
					useRelationsStore().hydrate(),
					useCollectionsStore().hydrate(),
					usePermissionsStore().hydrate(),
				]);
				useServerStore().info.queryLimit = { default: 100, max: -1 };
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const noteInput = () =>
	[
		...document.querySelectorAll<HTMLElement>('main [data-field="note"] input, main [data-field="note"] textarea'),
	][0] as HTMLInputElement | undefined;

const patches = () =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === 'PATCH' && new URL(String(input)).pathname === '/collections/bo_std')
		.map(([, init]) => JSON.parse(String(init!.body)));

async function editNote(value: string) {
	const input = noteInput()!;
	input.value = value;
	input.dispatchEvent(new Event('input'));
	await flushPromises();
}

test(
	'header and form: the directus_collections fields without sort, group and collapse',
	async () => {
		await setup('bo_std');

		expect(document.querySelector('h1')!.textContent).toContain('Bo Std');
		expect(document.querySelector('a[href="/settings/data-model"]')).not.toBeNull();
		expect(button(t('delete_collection'))).not.toBeNull();
		expect(button(t('save'))!.disabled).toBe(true);
		expect(document.body.textContent).toContain(t('fields_and_layout'));
		expect(document.body.textContent).toContain(t('saves_automatically'));

		const fields = [...document.querySelectorAll('main [data-field]')].map((el) => el.getAttribute('data-field'));
		expect(fields).toEqual(
			expect.arrayContaining(['note', 'display_template', 'archive_field', 'sort_field', 'accountability']),
		);
		expect(fields).not.toEqual(expect.arrayContaining(['sort']));
		expect(fields).not.toContain('group');
		expect(fields).not.toContain('collapse');
		expect(document.body.textContent).not.toContain(t('collection_content_toggles'));
	},
	SLOW,
);

test(
	'save sends only the edited meta keys, then goes back to the list; Ctrl/Cmd+S saves and stays',
	async () => {
		const { router } = await setup('bo_std');

		await editNote('A note');
		expect(button(t('save'))!.disabled).toBe(false);
		for (const key of ['Control', 's'])
			document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
		await flushPromises();
		expect(patches()).toEqual([{ meta: { note: 'A note' } }]);
		expect(router.currentRoute.value.name).toBe('settings-fields');

		await editNote('Another');
		button(t('save'))!.click();
		await flushPromises();
		expect(patches().at(-1)).toEqual({ meta: { note: 'Another' } });
		expect(router.currentRoute.value.name).toBe('settings-collections');
	},
	SLOW,
);

test(
	'leaving with edits asks first, Keep Editing first',
	async () => {
		const { router } = await setup('bo_std');

		await editNote('Unsaved');
		await router.push('/settings/data-model');
		await flushPromises();

		const dialog = document.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain(t('unsaved_changes'));
		const buttons = [...dialog.querySelectorAll('button')].map((b) => b.textContent!.trim());
		expect(buttons.slice(-2)).toEqual([t('keep_editing'), t('discard_changes')]);
		expect(router.currentRoute.value.name).toBe('settings-fields');
	},
	SLOW,
);

test(
	'delete: the confirm dialog, DELETE /collections/:c, back to the list',
	async () => {
		const { router } = await setup('bo_std');

		button(t('delete_collection'))!.click();
		await flushPromises();
		const dialog = document.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain(t('delete_are_you_sure'));
		[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_label'))!.click();
		await flushPromises();

		expect(calls(fetch)).toContain('DELETE /collections/bo_std');
		expect(router.currentRoute.value.name).toBe('settings-collections');
	},
	SLOW,
);

test(
	'a system collection: no delete button, the form is read-only',
	async () => {
		await setup('directus_users');

		expect(button(t('delete_collection'))).toBeNull();
		expect(noteInput()!.disabled).toBe(true);
	},
	SLOW,
);

// The three directus_fields rows of migration 20261026A: user fields (not system), no sort, no group.
const toggleField = (field: string, index: number) =>
	({
		collection: 'directus_collections',
		field,
		type: 'boolean',
		schema: { default_value: true, is_nullable: true },
		meta: {
			id: 9001 + index,
			collection: 'directus_collections',
			field,
			special: ['cast-boolean'],
			interface: 'boolean',
			width: 'half',
			sort: null,
			group: null,
			hidden: false,
			system: false,
		},
	}) as unknown as FieldRaw;

test(
	'spec 022 (D-182): the bo_show_* toggles are one card with its title, just before Duplication (owner 2026-10-27)',
	async () => {
		const toggles = ['bo_show_search', 'bo_show_import', 'bo_show_export'];
		await setup('bo_std', toggles.map(toggleField));

		const titles = [...document.querySelectorAll('main h3')].map((h) => h.textContent);
		const title = t('collection_content_toggles');
		expect(titles.slice(-2)).toEqual([title, t('field_options.directus_collections.duplication_divider')]);
		const card = document.querySelectorAll('main h3')[titles.indexOf(title)]!.closest('.rounded-2xl')!;
		expect([...card.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field'))).toEqual(toggles);
	},
	SLOW,
);
