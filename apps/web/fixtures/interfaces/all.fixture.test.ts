// T090 (US7 scenarios 1-2, SC-001, SC-002): for every bo_* collection of the fixture snapshot and each fixture user,
// BoForm with every seeded item and a table (BoTable + RenderDisplay) of the collection's fields render with no
// `interface_not_found` notice, no failed interface or display, no Vue warning or error and no edit emitted on mount;
// requests stay in contracts/api-calls.md.
// The map interface stays a placeholder here: MapLibre needs WebGL, which happy-dom lacks (its render and options run
// in InterfaceMap.test.ts with fakes and InterfaceMap.browser.test.ts in chromium); so does the TinyMCE editor of the
// rich text HTML interface (its frame, counter and drawers still render). The block editor, markdown and rich text
// HTML chunks are loaded before the tests, so they render like the other interfaces.
import { format } from 'node:util';
import { readItems } from '@directus/sdk';
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../../src/api/sdk.ts';
import BoTable from '../../src/components/BoTable.vue';
import BoForm from '../../src/components/form/BoForm.vue';
import RenderDisplay from '../../src/components/render/RenderDisplay.vue';
import { i18n } from '../../src/lang/index.ts';
import { useCollectionsStore } from '../../src/stores/collections.ts';
import { useFieldsStore } from '../../src/stores/fields.ts';
import { useFlowsStore } from '../../src/stores/flows.ts';
import { usePermissionsStore } from '../../src/stores/permissions.ts';
import { useRelationsStore } from '../../src/stores/relations.ts';
import { useServerStore } from '../../src/stores/server.ts';
import { useSettingsStore } from '../../src/stores/settings.ts';
import { useUserStore } from '../../src/stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../src/test-utils/fetch.ts';
import { type FixtureUser, loadSnapshot } from '../../src/test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../src/utils/adjust-fields-for-displays.ts';
import { getDefaultDisplayForType } from '../../src/utils/get-default-display-for-type.ts';

vi.mock('../../src/interfaces/map/InterfaceMap.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		__esModule: true,
		default: defineComponent({ inheritAttrs: false, render: () => h('div', { 'data-map-placeholder': '' }) }),
	};
});

// TinyMCE starts only in a standards mode document with a real iframe, which happy-dom lacks: the editor is a
// placeholder here (InputRichTextHtml.browser.test.ts and rich.fixture.browser.test.ts run it in chromium).
vi.mock('@tinymce/tinymce-vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		__esModule: true,
		default: defineComponent({ inheritAttrs: false, render: () => h('div', { 'data-tinymce-placeholder': '' }) }),
	};
});

enableAutoUnmount(afterEach);

beforeAll(async () => {
	// The async interface chunks resolve before the first form, as on a warm app.
	await Promise.all([
		import('../../src/interfaces/input-block-editor/InputBlockEditor.vue'),
		import('../../src/interfaces/input-rich-text-md/InputRichTextMd.vue'),
		import('../../src/interfaces/input-rich-text-html/InputRichTextHtml.vue'),
	]);
});

const snapshot = loadSnapshot();
// bo_insights_data (018) is the data of the Insights dashboards: no interface set and no editor/viewer permission.
const COLLECTIONS = Object.keys(snapshot.items)
	.filter((collection) => collection !== 'bo_insights_data')
	.sort();
const USERS: FixtureUser[] = ['admin', 'bo-editor', 'bo-viewer'];

const LIST_PROP_WARNING = `Invalid prop: type check failed for prop "value". Expected Array | Null, got Object at <InterfaceList>
at <ErrorBoundary>
at <FormFieldInterface>
at <FormField>
at <BoForm>
at <VTUROOT>`;
const STATUS_FORBIDDEN = `You don't have permission to access field "status" in collection "bo_rel_target" or it does not exist.`;

/**
 * Console warnings the fixture causes on purpose, keyed by `<user> <collection>`, each with its reason. Matched
 * exactly: a warning that no longer happens fails the test too.
 */
const EXPECTED_WARNINGS: Record<string, string[]> = Object.fromEntries([
	// bo_std item 3 holds `list = {"not":"an array"}`, a value in the wrong shape written on purpose (CHK006); Vue checks
	// the `value: Array | null` prop of the list interface as it does in Directus (the interface still renders).
	...USERS.map((user) => [`${user} bo_std`, [LIST_PROP_WARNING]]),
	// bo-editor cannot read bo_rel_target.status (permissions.bo-editor.json), which the m2o template of items 1 and 3
	// and the table layouts of o2m_table and m2m_table ask for: the API answers 403 as Directus does and the relational
	// interfaces log it through unexpectedError (unexpected-error.ts).
	['bo-editor bo_rel', [STATUS_FORBIDDEN, STATUS_FORBIDDEN, STATUS_FORBIDDEN, STATUS_FORBIDDEN]],
	// bo-viewer reads only its own directus_users row; `owner` of item 1 points at the editor (bo-9), so the m2o
	// lookup answers 403 as in Directus.
	['bo-viewer bo_rel', ["You don't have permission to access this."]],
	// bo_content (014): `author` of the 15 even items points at the admin, whom neither bo-editor nor bo-viewer may
	// read, so each m2o lookup answers 403 as in Directus.
	...(['bo-editor', 'bo-viewer'] as const).map((user) => [
		`${user} bo_content`,
		Array.from({ length: 15 }, () => "You don't have permission to access this."),
	]),
]);

let fetch: ReturnType<typeof mockFixtureApi>;
let warnings: string[];
let errors: string[];

async function setup(user: FixtureUser) {
	vi.unstubAllGlobals();
	// No rate limit of the app queue (5 requests per 500 ms) in tests.
	await replaceQueue();
	setActivePinia(createPinia());
	Element.prototype.scrollIntoView = vi.fn();
	fetch = mockFixtureApi(snapshot, {
		user,
		// The server store reads the login providers too (012 route #2).
		answers: { 'GET /auth': () => json({ data: [], disableDefault: false }) },
	});
	// The order of hydrate.ts: the user first, then the stores that read it.
	await useUserStore().hydrate();
	await Promise.all([
		usePermissionsStore().hydrate(),
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		useServerStore().hydrate(),
		useSettingsStore().hydrate(),
	]);
	await useFlowsStore().hydrate();

	warnings = [];
	errors = [];
	vi.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(message(args)));
	vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(message(args)));
}

/** A console call as text; an API error by its message. */
const message = (args: unknown[]) =>
	format(...args.map((arg) => (arg instanceof Object && 'errors' in arg && 'message' in arg ? arg.message : arg)));

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

function globalOptions(collection: string) {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
	void router.push(`/content/${collection}`);

	return {
		plugins: [i18n, router],
		config: {
			warnHandler: (message: string, _vm: unknown, trace: string) => warnings.push(`${message}${trace}`),
			errorHandler: (error: unknown, _vm: unknown, info: string) => errors.push(`${info}: ${format(error)}`),
		},
	};
}

/** The fields of the collection the user can read (the API leaves the others out of /fields for that user). */
function readableFields(user: FixtureUser, collection: string): Field[] {
	const read = (snapshot.permissions[user] as Record<string, any>)[collection]?.read;
	const all = useFieldsStore().getFieldsForCollection(collection);
	if (user === 'admin' || read?.fields.includes('*')) return all;
	return all.filter((field) => read?.fields.includes(field.field));
}

/**
 * `<field>: <text>` of every notice FormFieldInterface shows instead of an interface: `interface_not_found` or the
 * error boundary's `unexpected_error` (a failed display only logs, see the warning check).
 */
const notices = (wrapper: { element: Element }) =>
	[...wrapper.element.querySelectorAll('[data-interface] > [role="status"]')].map(
		(notice) => `${notice.closest('[data-field]')?.getAttribute('data-field')}: ${notice.textContent?.trim()}`,
	);

// Each case mounts a whole collection; under the full parallel run (unit + browser) one can pass the 5 s default.
describe.each(USERS)('user %s', { timeout: 30_000 }, (user) => {
	beforeEach(() => setup(user));

	test.each(COLLECTIONS)('%s: form of every seeded item and the table', async (collection) => {
		const pk = useFieldsStore().getPrimaryKeyFieldForCollection(collection)!.field;
		// The rows as the item page reads them with `fields=*`: relations as keys.
		const rows = fetch.db[collection]!;

		for (const item of rows) {
			const form = mount(BoForm, {
				props: { collection, primaryKey: item[pk], initialValues: item, modelValue: {} },
				global: globalOptions(collection),
				attachTo: document.body,
			});

			await flushPromises();
			await flushPromises();

			expect(form.emitted('update:modelValue'), `${collection} ${item[pk]}`).toBeUndefined();
			expect(notices(form), `${collection} ${item[pk]} ${warnings.join('\n')}`).toEqual([]);
		}

		const fields = readableFields(user, collection).filter(
			(field) => !field.meta?.special?.some((special) => ['no-data', 'group'].includes(special)),
		);

		const answer = await sdk.request(
			readItems(
				collection as never,
				{
					fields: adjustFieldsForDisplays(
						fields.map((field) => field.field),
						collection,
					),
					limit: -1,
				} as never,
			),
		);

		// A singleton read answers its one row as an object, like Directus (014 mock API).
		const tableRows = (Array.isArray(answer) ? answer : [answer]) as Record<string, unknown>[];

		expect(tableRows).toHaveLength(rows.length);

		const display = (field: Field) => field.meta?.display || getDefaultDisplayForType(field.type);

		const table = mount(BoTable, {
			props: {
				columns: fields.map((field) => ({ key: field.field, label: field.name })),
				rows: tableRows,
				rowKey: pk,
			},
			slots: Object.fromEntries(
				fields.map((field) => [
					`item.${field.field}`,
					// Typed loosely: BoTable's slot types also cover the `header.*` slots.
					(props: any) =>
						h(RenderDisplay, {
							value: props.item[field.field],
							display: display(field),
							options: field.meta?.display_options,
							interface: field.meta?.interface,
							interfaceOptions: field.meta?.options,
							type: field.type,
							collection,
							field: field.field,
						}),
				]),
			),
			global: globalOptions(collection),
			attachTo: document.body,
		});

		await flushPromises();

		expect(table.findAll('tbody tr')).toHaveLength(rows.length);

		expect(warnings).toEqual(EXPECTED_WARNINGS[`${user} ${collection}`] ?? []);
		expect(errors).toEqual([]);
	});
});
