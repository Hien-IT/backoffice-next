// T067 (contracts/tests.md §5, SC-002): BoForm on bo_rel, bo_tree and bo_translations of the fixture snapshot with the
// real relational interfaces and the real drawers (DrawerCollection, DrawerItem): US3 scenarios 1-5 and the edit
// scenarios of fixtures/interfaces/snapshot/expected.<id>.json (the emitted field value equals the Directus value),
// the permission table of FR-041 for the three fixture users, and a read-only form that still opens links.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, type Pinia, setActivePinia } from 'pinia';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../api/sdk.ts';
import BoTable from '../components/BoTable.vue';
import BoForm from '../components/form/BoForm.vue';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { useUserStore } from '../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import {
	type ExpectedScenario,
	type FixtureUser,
	loadSnapshot,
	type Row,
	type Snapshot,
} from '../test-utils/fixtures.ts';

enableAutoUnmount(afterEach);

// Real drawers and forms (or editors) per scenario: slow on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

// DrawerItem loads BoForm lazily (import cycle with the interface registry): load it once up front.
beforeAll(() => import('../components/form/BoForm.vue'));

const RELATIONAL = [
	'select-dropdown-m2o',
	'list-o2m',
	'list-m2m',
	'list-m2a',
	'list-o2m-tree-view',
	'translations',
	'collection-item-dropdown',
	'collection-item-multiple-dropdown',
];

interface Scenario extends ExpectedScenario {
	collection: string;
	field: string;
	initial: unknown;
	action: string | string[];
}

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let hydrateCalls = 0;
// Installed in every mounted app: a late store action of the previous test's components (throttled useItems) makes
// its own pinia the active one again, components of this test still inject this one.
let pinia: Pinia;

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

async function setup(user: FixtureUser = 'admin', change?: (snapshot: Snapshot) => void) {
	vi.unstubAllGlobals();
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	const source = loadSnapshot();
	change?.(source);
	fetch = mockFixtureApi(source, { user });
	await useUserStore(pinia).hydrate();

	await Promise.all([
		useFieldsStore(pinia).hydrate(),
		useRelationsStore(pinia).hydrate(),
		useCollectionsStore(pinia).hydrate(),
		usePermissionsStore(pinia).hydrate(),
	]);

	hydrateCalls = fetch.mock.calls.length;
}

beforeEach(async () => {
	Element.prototype.scrollIntoView = vi.fn();
	localStorage.clear();
	window.innerWidth = 1280;
	await router.push('/content/bo_rel/1');
	await setup();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.restoreAllMocks();
});

/** Requests after the store hydration. */
const ownCalls = () => calls(fetch).slice(hydrateCalls);

/** A `fields=*.*` row as the item page holds it (`fields=*`): related objects become their keys, json stays. */
function keysOnly(row: Row): Row {
	const key = (value: any) => (value && typeof value === 'object' && 'id' in value ? value.id : value);
	return Object.fromEntries(
		Object.entries(row).map(([name, value]) => [name, Array.isArray(value) ? value.map(key) : key(value)]),
	);
}

const itemOf = (collection: string, id: number) =>
	keysOnly(snapshot.items[collection]!.find((row) => row['id'] === id)!);

/** The stored (`$t:` translated) meta of a field, to adjust before mounting. */
const meta = (collection: string, field: string) => useFieldsStore(pinia).getField(collection, field)!.meta!;

/** Mounts the form of an item like the item screen: v-model on the edits, the item as initial values. */
async function mountForm(collection: string, id: number, props: Record<string, unknown> = {}) {
	const wrapper = mount(BoForm, {
		props: {
			collection,
			primaryKey: id,
			initialValues: itemOf(collection, id),
			modelValue: {},
			'onUpdate:modelValue': (edits: Record<string, unknown>) => wrapper.setProps({ modelValue: edits }),
			...props,
		},
		global: { plugins: [i18n, router, pinia] },
		attachTo: document.body,
	});

	await settle();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountForm>>;

/** useItems throttles its requests by 500 ms. */
async function settle(ms = 0) {
	await new Promise((resolve) => setTimeout(resolve, ms));
	await flushPromises();
	await flushPromises();
}

const fieldEl = (wrapper: Wrapper, name: string) => wrapper.get(`[data-field="${name}"]`);
const lastEdits = (wrapper: Wrapper) => wrapper.emitted<[Record<string, unknown>]>('update:modelValue')?.at(-1)?.[0];

/** The drawer on top (drawers are teleported to the body). */
const panel = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1)!;

async function click(el: Element | null | undefined) {
	if (!el) throw new Error('Nothing to click');
	(el as HTMLElement).click();
	await settle();
}

async function key(el: Element, name: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
	await settle();
}

async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input'));
	await settle();
}

/** Waits for the open selection drawer's table, then its rows (texts). */
async function drawerRows() {
	await vi.waitFor(() => expect(panel()?.querySelector('tbody tr td')).not.toBeNull());
	await settle(550);
	return [...panel().querySelectorAll('tbody tr')].map((tr) => tr.textContent!.trim());
}

/** Checks the rows of the selection drawer whose text contains each name, then applies the drawer. */
async function pick(...names: string[]) {
	const rows = [...panel().querySelectorAll('tbody tr')];

	for (const name of names) {
		const row = rows.find((tr) => tr.textContent!.includes(name));
		if (!row) throw new Error(`No row "${name}" in ${rows.map((r) => r.textContent).join(' | ')}`);
		await click(row.querySelector('[role="checkbox"]'));
	}

	await saveDrawer();
}

async function saveDrawer() {
	await click(panel().querySelector('header button[aria-label="Save"]'));
	await settle();
}

/** Types into a field of the item drawer on top (`main` form or the related `junction` form). */
async function typeInDrawer(field: string, value: string, form = 'main') {
	await vi.waitFor(() =>
		expect(panel().querySelector(`[data-form="${form}"] [data-field="${field}"] input`)).not.toBeNull(),
	);
	await type(panel().querySelector<HTMLInputElement>(`[data-form="${form}"] [data-field="${field}"] input`)!, value);
}

/** Opens a BoMenu by keyboard and runs the item with this text. */
async function menu(trigger: Element, text: string) {
	(trigger as HTMLElement).focus();
	await key(trigger, 'Enter');
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent!.trim().endsWith(text),
	);
	if (!item) throw new Error(`No menu item "${text}"`);
	item.focus();
	await key(item, 'Enter');
}

const button = (root: Element, text: string) =>
	[...root.querySelectorAll('button')].find((b) => b.textContent!.trim().includes(text) || b.ariaLabel === text);

/* ---------------------------------------------------------------- edit scenarios of expected.<id>.json */

type Runner = (wrapper: Wrapper) => Promise<void>;

const RUNNERS: Record<string, Record<string, { id?: number; run: Runner }>> = {
	'select-dropdown-m2o': {
		'select through the templated filter': {
			run: async (wrapper) => {
				await type(fieldEl(wrapper, 'title').get<HTMLInputElement>('input').element, 'three');
				await click(fieldEl(wrapper, 'm2o').get('button.main').element);

				expect(await drawerRows()).toEqual([expect.stringContaining('Target three')]);
				// FR-041: `{{ title }}` filled with the current form value.
				expect(ownCalls()).toContainEqual(
					expect.stringContaining('GET /items/bo_rel_target?filter={"_and":[{"name":{"_contains":"three"}}]}'),
				);

				await pick('Target three');
				expect(fieldEl(wrapper, 'm2o').get('.preview').text()).toBe('Target three (Published)');
			},
		},
		'edit the related item in the drawer': {
			run: async (wrapper) => {
				await click(fieldEl(wrapper, 'm2o').get('button[aria-label="Edit Item"]').element);
				await typeInDrawer('name', 'Target one!');
				await saveDrawer();
			},
		},
		deselect: {
			run: async (wrapper) => {
				await click(fieldEl(wrapper, 'm2o').get('button[aria-label="Deselect"]').element);
			},
		},
	},
	'list-o2m': {
		'select an existing item, create one, remove one': {
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'o2m_list').element;

				await click(field.querySelector('[data-action="select"]'));
				// FR-041: the option filter plus the items of other parents only.
				expect(await drawerRows()).toEqual([
					expect.stringContaining('Target one'),
					expect.stringContaining('Target five'),
				]);
				await pick('Target five');

				await click(field.querySelector('[data-action="create"]'));
				await typeInDrawer('name', 'New target');
				await saveDrawer();

				await click(field.querySelectorAll('li button[aria-label="Remove Item"]')[0]);
			},
		},
	},
	'list-m2m': {
		'select two, create one, remove one': {
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'm2m_list').element;

				await click(field.querySelector('[data-action="select"]'));
				expect(await drawerRows()).toHaveLength(5);
				await pick('Target two', 'Target three');

				await click(field.querySelector('[data-action="create"]'));
				await typeInDrawer('name', 'New target', 'junction');
				await saveDrawer();

				// the third seeded junction row (Target five)
				await click(field.querySelectorAll('li button[aria-label="Remove Item"]')[2]);

				expect([...field.querySelectorAll('li [data-action="edit"]')].map((row) => row.textContent!.trim())).toEqual([
					'Target one',
					'Target one',
					'Target five',
					'Target two',
					'Target three',
					'New target',
				]);
			},
		},
	},
	'list-m2a': {
		'add an existing item of the second collection, create one in the first': {
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'm2a').element;

				await menu(button(field, 'Add Existing')!, 'Bo M2A B');
				expect(await drawerRows()).toEqual([expect.stringContaining('B two')]);
				await pick('B two');

				await menu(button(field, 'Create New')!, 'Bo M2A A');
				await typeInDrawer('name', 'A three', 'junction');
				await saveDrawer();
			},
		},
	},
	'list-o2m-tree-view': {
		'create a child, then move the first child down': {
			id: 1,
			run: async (wrapper) => {
				const field = fieldEl(wrapper, 'children').element;

				await click(field.querySelector('button.create'));
				await typeInDrawer('name', 'New child');
				await saveDrawer();

				await menu(field.querySelector('button.row-menu[aria-label="Options for Child A"]')!, 'Move down');
			},
		},
	},
	translations: {
		'edit the second language': {
			id: 1,
			run: async (wrapper) => {
				const vi_ = wrapper.get('[data-lang="vi-VN"]');
				await type(vi_.get<HTMLInputElement>('[data-field="title"] input').element, 'Chào');
			},
		},
		'enable and fill a language of an item without it': {
			id: 2,
			run: async (wrapper) => {
				const en = wrapper.get('[data-lang="en-US"]');
				await click(en.get('[data-testid="enable-translation"]').element);
				await type(
					wrapper.get('[data-lang="en-US"]').get<HTMLInputElement>('[data-field="title"] input').element,
					'Hi',
				);
			},
		},
	},
	'collection-item-dropdown': {
		'select another item': {
			run: async (wrapper) => {
				await click(fieldEl(wrapper, 'collection_item').get('button.main').element);
				// option filter: status not archived
				expect(await drawerRows()).toHaveLength(4);
				await pick('Target two');
			},
		},
	},
	'collection-item-multiple-dropdown': {
		'unselect one item': {
			run: async (wrapper) => {
				await click(button(fieldEl(wrapper, 'collection_items').element, 'Select Item'));
				expect(await drawerRows()).toHaveLength(2);
				await pick('A one');
			},
		},
	},
};

test('every relational interface has an expected file and every scenario a runner', () => {
	expect(Object.keys(snapshot.expected)).toEqual(expect.arrayContaining(RELATIONAL));

	for (const id of RELATIONAL)
		expect(Object.keys(snapshot.expected[id]!).sort(), id).toEqual(Object.keys(RUNNERS[id]!).sort());
});

describe.each(RELATIONAL)('expected.%s.json', (id) => {
	const scenarios = Object.entries((snapshot.expected[id] ?? {}) as unknown as Record<string, Scenario>);

	test.each(scenarios)('%s', async (name, scenario) => {
		const { id: itemId = 1, run } = RUNNERS[id]![name]!;
		expect(meta(scenario.collection, scenario.field).interface).toBe(id);
		expect(scenario.initial).toEqual(itemOf(scenario.collection, itemId)[scenario.field]);

		const wrapper = await mountForm(scenario.collection, itemId);
		expect(wrapper.emitted('update:modelValue'), 'no edit on mount').toBeUndefined();

		await run(wrapper);

		expect(lastEdits(wrapper)).toHaveProperty([scenario.field]);
		expect(JSON.parse(JSON.stringify(lastEdits(wrapper)![scenario.field]))).toEqual(scenario.value);
	});
});

/* ---------------------------------------------------------------- US3 scenarios */

describe('US3 on the fixture forms', () => {
	test.each<[string, number]>([
		['bo_rel', 1],
		['bo_rel', 2],
		['bo_tree', 1],
		['bo_translations', 1],
	])('%s/%i: every field renders, no edit on mount', async (collection, id) => {
		const wrapper = await mountForm(collection, id);
		await settle(550);

		expect(wrapper.text()).not.toContain('interface_not_found');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('US3-2: o2m table with more than 10 items: search, pagination, column widths kept per field', async () => {
		// 12 children of bo_rel 1 in o2m_table (one seeded), limit 5 as in the scenario.
		await setup('admin', (source) => {
			for (let i = 0; i < 11; i++)
				source.items['bo_rel_target']!.push({
					id: 100 + i,
					name: `Extra ${String(i).padStart(2, '0')}`,
					status: 'draft',
					sort: 100 + i,
					o2m_list_parent: null,
					o2m_table_parent: 1,
				});
		});
		meta('bo_rel', 'o2m_table').options!['limit'] = 5;

		const wrapper = await mountForm('bo_rel', 1);
		const field = () => fieldEl(wrapper, 'o2m_table');
		const names = () =>
			field()
				.findAll('tbody tr')
				.map((tr) => tr.findAll('td')[1]!.text());

		expect(field().get('.item-count').text()).toBe('1-5 of 12 Items');
		// sort "name" ascending (options sort and sortDirection, no sort field on the relation)
		expect(names()).toEqual(['Extra 00', 'Extra 01', 'Extra 02', 'Extra 03', 'Extra 04']);
		expect(field().find('tbody tr').classes()).toContain('h-[29px]');

		await click(field().get('button[aria-label="Next"]').element);
		await settle(550);
		expect(field().get('.item-count').text()).toBe('6-10 of 12 Items');
		expect(ownCalls().some((c) => c.startsWith('GET /items/bo_rel_target?') && c.includes('page=2'))).toBe(true);

		await type(field().get<HTMLInputElement>('input[type="search"]').element, 'four');
		await settle(550);
		expect(ownCalls().some((c) => c.startsWith('GET /items/bo_rel_target?') && c.includes('search=four'))).toBe(true);
		expect(names()).toEqual(['Target four']);

		const table = field().findComponent(BoTable);
		const columns = table.props('columns') as { key: string; width: number }[];
		table.vm.$emit(
			'update:columns',
			columns.map((column) => (column.key === 'name' ? { ...column, width: 260 } : column)),
		);
		window.dispatchEvent(new Event('pointerup'));
		await settle();
		expect(JSON.parse(localStorage.getItem('backoffice-o2m-column-widths-bo_rel-o2m_table')!)).toEqual({ name: 260 });
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('US3-4: translations: first and second language side by side above 960 px, progress per language', async () => {
		const wrapper = await mountForm('bo_translations', 1);
		const forms = () => wrapper.findAll('[data-lang]').map((form) => form.attributes('data-lang'));

		expect(forms()).toEqual(['en-US', 'vi-VN']);
		expect(wrapper.get('[data-lang="vi-VN"] [data-field="title"] input').element).toHaveProperty('value', 'Xin chào');

		const trigger = wrapper.get('[data-lang="en-US"] button[aria-haspopup="menu"]').element as HTMLElement;
		trigger.focus();
		await key(trigger, 'Enter');
		const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
		expect(items.map((item) => item.textContent!.replace(/\d+%?/g, '').trim())).toEqual(
			expect.arrayContaining([expect.stringContaining('English'), expect.stringContaining('العربية')]),
		);
		await key(items[0]!, 'Escape');

		// 960 px or less: one language only
		window.innerWidth = 960;
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(forms()).toEqual(['en-US']);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});

/* ---------------------------------------------------------------- FR-041 permission table */

interface Allowed {
	o2mCreate: boolean;
	o2mSelect: boolean;
	m2mCreate: boolean;
	m2mSelect: boolean;
	m2mRemove: boolean;
	m2aCreate: string[];
	m2aSelect: boolean;
	filesUpload: boolean;
	filesSelect: boolean;
	m2oCreate: boolean;
}

describe('FR-041 permissions (use-relation-permissions.ts) per fixture user', () => {
	test.each<[FixtureUser, Allowed]>([
		[
			'admin',
			{
				o2mCreate: true,
				o2mSelect: true,
				m2mCreate: true,
				m2mSelect: true,
				m2mRemove: true,
				m2aCreate: ['Bo M2A A', 'Bo M2A B'],
				m2aSelect: true,
				filesUpload: true,
				filesSelect: true,
				m2oCreate: true,
			},
		],
		// bo-editor: create/update on the junctions and bo_m2a_a only; bo_rel_target and directus_files read only.
		// list-m2a.vue shows "Create New" when one collection allows create, then lists every allowed collection
		// (`allowedCollections`, not `createCollections`): Bo M2A B is offered although bo-editor cannot create there.
		[
			'bo-editor',
			{
				o2mCreate: false,
				o2mSelect: false,
				m2mCreate: false,
				m2mSelect: true,
				m2mRemove: true,
				m2aCreate: ['Bo M2A A', 'Bo M2A B'],
				m2aSelect: true,
				filesUpload: false,
				filesSelect: true,
				m2oCreate: false,
			},
		],
		[
			'bo-viewer',
			{
				o2mCreate: false,
				o2mSelect: false,
				m2mCreate: false,
				m2mSelect: false,
				m2mRemove: false,
				m2aCreate: [],
				m2aSelect: false,
				filesUpload: false,
				filesSelect: false,
				m2oCreate: false,
			},
		],
	])('%s', async (user, allowed) => {
		await setup(user);
		const wrapper = await mountForm('bo_rel', 1);
		const has = (field: string, selector: string) => fieldEl(wrapper, field).find(selector).exists();

		const m2a = fieldEl(wrapper, 'm2a').element;
		const createNew = button(m2a, 'Create New');
		let m2aCreate: string[] = [];

		if (createNew) {
			(createNew as HTMLElement).focus();
			await key(createNew, 'Enter');
			// the text nodes only (the collection icon is a ligature)
			m2aCreate = [...document.querySelectorAll('[role="menuitem"]')].map((el) =>
				[...el.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join('')
					.trim(),
			);
			await key(document.querySelector('[role="menuitem"]')!, 'Escape');
		}

		const files = fieldEl(wrapper, 'files').element;

		expect({
			o2mCreate: has('o2m_list', '[data-action="create"]'),
			o2mSelect: has('o2m_list', '[data-action="select"]'),
			m2mCreate: has('m2m_list', '[data-action="create"]'),
			m2mSelect: has('m2m_list', '[data-action="select"]'),
			m2mRemove: has('m2m_list', 'li button[aria-label="Remove Item"]'),
			m2aCreate,
			m2aSelect: button(m2a, 'Add Existing') !== undefined,
			filesUpload: button(files, 'Upload File') !== undefined,
			filesSelect: button(files, 'Add Existing') !== undefined,
			// m2o: the create icon shows on an empty value; select needs no permission (select-dropdown-m2o.vue)
			m2oCreate: await (async () => {
				const empty = await mountForm('bo_rel', 2);
				return empty.get('[data-field="m2o"]').find('button[aria-label="Create Item"]').exists();
			})(),
		}).toEqual(allowed);

		// the seeded rows show for everyone (read permission)
		expect(fieldEl(wrapper, 'm2m_list').findAll('li [data-action="edit"]')).toHaveLength(3);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});

/* ---------------------------------------------------------------- read-only */

describe('FR-041 read-only form', () => {
	test('disabled (Directus item page without update permission): actions disabled, values kept, nothing emitted', async () => {
		const wrapper = await mountForm('bo_rel', 1, { disabled: true });

		for (const name of ['o2m_list', 'm2m_list'])
			for (const action of ['create', 'select'])
				expect(
					fieldEl(wrapper, name).find(`[data-action="${action}"]`).attributes('disabled'),
					`${name} ${action}`,
				).toBeDefined();
		expect(fieldEl(wrapper, 'm2o').get('button.main').attributes('disabled')).toBeDefined();
		expect(fieldEl(wrapper, 'm2o').get('.preview').text()).toBe('Target one (Published)');
		expect(fieldEl(wrapper, 'm2m_list').findAll('li [data-action="edit"]')).toHaveLength(3);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	test('nonEditable: links still open the related item, rows open read-only drawers, no edit actions', async () => {
		const wrapper = await mountForm('bo_rel', 1, { nonEditable: true });

		const m2o = fieldEl(wrapper, 'm2o');
		expect(m2o.find('button[aria-label="Edit Item"]').exists()).toBe(false);
		expect(m2o.find('button[aria-label="Deselect"]').exists()).toBe(false);
		await click(m2o.get('a.item-link').element);
		expect(router.currentRoute.value.fullPath).toBe('/content/bo_rel_target/1');

		const o2m = fieldEl(wrapper, 'o2m_list');
		expect(o2m.find('[data-action="create"]').exists()).toBe(false);
		expect(o2m.find('li button[aria-label="Remove Item"]').exists()).toBe(false);
		expect(o2m.findAll('a.item-link').map((a) => a.attributes('href'))).toEqual([
			'/content/bo_rel_target/2',
			'/content/bo_rel_target/3',
		]);

		// a row opens the related item read only
		await click(fieldEl(wrapper, 'm2m_list').get('li [data-action="edit"]').element);
		await vi.waitFor(() =>
			expect(panel().querySelector('[data-form="junction"] [data-field="name"] input')).not.toBeNull(),
		);
		expect(panel().querySelector<HTMLInputElement>('[data-form="junction"] [data-field="name"] input')!.disabled).toBe(
			true,
		);
		expect(panel().querySelector<HTMLButtonElement>('header button[aria-label="Save"]')!.disabled).toBe(true);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});
