// Directus has no test for system-filter (spec FR-041, SC-004). The samples below were recorded on 2026-10-15 on the
// Directus 11.17.4 app (fixture set bo_*, admin): /admin/content/bo_content → search bar filter button → the steps
// written next to each sample, then the `filter` of the `PATCH /presets/<admin preset of bo_content>` body the app
// sent. The component must read each one and write it back unchanged, and the same steps here must give the same JSON.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import config from './index.ts';
import Nodes from './Nodes.vue';
import SystemFilter from './SystemFilter.vue';

// After hooks run in reverse order: unmount first, then clear the portals left in the body.
afterEach(() => {
	document.body.innerHTML = '';
});

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();

beforeEach(() => {
	setActivePinia(createPinia());
	const fieldsStore = useFieldsStore();
	fieldsStore.fields = [...snapshot.fields, ...snapshot.systemFields].map(fieldsStore.parseField);
	useRelationsStore().relations = snapshot.relations;
});

/** Filters recorded on the Directus app (see the header), keyed by sample. */
const SAMPLES = {
	// Add Filter → Title; type "Content" (default operator of a string: Contains).
	title: { _and: [{ title: { _contains: 'Content' } }] },
	// Add Filter → Status (choices → Equals); value menu → Published.
	status: { _and: [{ status: { _eq: 'published' } }] },
	// Add Filter → Sort; operator Is between; type 1 and 5.
	sortBetween: { _and: [{ sort: { _between: ['1', '5'] } }] },
	// Add Filter → ID; operator Is one of; type "1,2,3".
	idIn: { _and: [{ id: { _in: ['1', '2', '3'] } }] },
	// Add Filter → Date Published; operator Greater than or equal to; type "$NOW(-7 days)".
	dateNow: { _and: [{ date_published: { _gte: '$NOW(-7 days)' } }] },
	// Add Filter → Author (Equals); type "$CURRENT_USER".
	authorMe: { _and: [{ author: { _eq: '$CURRENT_USER' } }] },
	// Add Filter → Date Published → Year (Date Published); type 2024.
	year: { _and: [{ 'year(date_published)': { _eq: '2024' } }] },
	// Add Filter → Author → First Name; type "Admin".
	authorName: { _and: [{ author: { first_name: { _contains: 'Admin' } } }] },
	// Add Filter → Body; operator Is null.
	bodyNull: { _and: [{ body: { _null: true } }] },
	// Add Filter → And / Or group, Status = Draft, Title contains "Content"; AND → OR; Status and Title dragged into
	// the group.
	orGroup: { _and: [{ _or: [{ status: { _eq: 'draft' } }, { title: { _contains: 'Content' } }] }] },
	// Status = Draft, And / Or group, Title contains "Content"; AND → OR; Title dragged into the group, then Status
	// dragged above the group.
	reordered: { _and: [{ status: { _eq: 'draft' } }, { _or: [{ title: { _contains: 'Content' } }] }] },
};

type Sample = keyof typeof SAMPLES;

function setup(value: Record<string, any> | string | null = null, props: Record<string, unknown> = {}) {
	const wrapper = mount(SystemFilter, {
		props: { value, collectionName: 'bo_content', ...props },
		global: {
			plugins: [i18n, createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })],
		},
		attachTo: document.body,
	});

	// Controlled like search-input: the emitted filter comes back as `value`.
	const last = () => wrapper.emitted('input')?.at(-1)?.[0];

	async function sync() {
		await wrapper.setProps({ value: (last() as Record<string, any> | null | undefined) ?? null });
		await flushPromises();
	}

	return { wrapper, last, sync };
}

type Setup = ReturnType<typeof setup>;

const treeItem = (text: string) =>
	[...document.body.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(
		(el) => el.querySelector('.truncate')?.textContent?.trim() === text,
	)!;

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

async function openAddFilter(s: Setup) {
	await s.wrapper.get('.add-filter').trigger('click');
	await flushPromises();
}

async function addField(s: Setup, ...path: string[]) {
	await openAddFilter(s);

	for (const segment of path.slice(0, -1)) {
		treeItem(segment).querySelector('button')!.click();
		await flushPromises();
	}

	treeItem(path.at(-1)!).click();
	await s.sync();
}

/** Text of a menu item without its Material Symbols icon name. */
function visibleText(el: Element) {
	return [...el.childNodes]
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent)
		.join('')
		.trim();
}

async function chooseMenuItem(trigger: Element, text: string) {
	(trigger as HTMLElement).focus();
	await key(trigger, 'Enter');
	const item = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => visibleText(el) === text);
	expect(item, text).toBeDefined();
	await key(item!, 'Enter');
}

async function operator(s: Setup, index: number, text: string) {
	await chooseMenuItem(s.wrapper.findAll('.comparator')[index]!.element, text);
	await s.sync();
}

async function typeIn(s: Setup, index: number, text: string) {
	const input = s.wrapper.findAll('input[type="text"]')[index]!;
	await input.setValue(text);
	await s.sync();
}

const BUILD: Record<Exclude<Sample, 'orGroup' | 'reordered'>, (s: Setup) => Promise<void>> = {
	title: async (s) => {
		await addField(s, 'Title');
		await typeIn(s, 0, 'Content');
	},
	status: async (s) => {
		await addField(s, 'Status');
		const valueButton = s.wrapper.findAll('.rule-header button').find((b) => b.text() === 'Select...')!;
		await chooseMenuItem(valueButton.element, 'Published');
		await s.sync();
	},
	sortBetween: async (s) => {
		await addField(s, 'Sort');
		await operator(s, 0, 'Is between');
		await typeIn(s, 0, '1');
		await typeIn(s, 1, '5');
	},
	idIn: async (s) => {
		await addField(s, 'ID');
		await operator(s, 0, 'Is one of');
		await typeIn(s, 0, '1');
		await typeIn(s, 1, '2');
		await typeIn(s, 2, '3');
	},
	dateNow: async (s) => {
		await addField(s, 'Date Published');
		await operator(s, 0, 'Greater than or equal to');
		await typeIn(s, 0, '$NOW(-7 days)');
	},
	authorMe: async (s) => {
		await addField(s, 'Author');
		await typeIn(s, 0, '$CURRENT_USER');
	},
	year: async (s) => {
		await addField(s, 'Date Published', 'Year (Date Published)');
		await typeIn(s, 0, '2024');
	},
	authorName: async (s) => {
		await addField(s, 'Author', 'First Name');
		await typeIn(s, 0, 'Admin');
	},
	bodyNull: async (s) => {
		await addField(s, 'Body');
		await operator(s, 0, 'Is null');
	},
};

describe('system-filter', () => {
	test('is registered with the Directus config, loaded on first use', () => {
		expect(config).toMatchObject({
			id: 'system-filter',
			name: '$t:interfaces.filter.name',
			icon: 'search',
			types: ['json'],
			options: [],
			system: true,
		});
		expect((config.component as { __asyncLoader?: unknown }).__asyncLoader).toBeTypeOf('function');
	});

	test.each(Object.keys(SAMPLES) as Sample[])('reads and writes back the Directus filter "%s"', async (name) => {
		const { wrapper, last } = setup(SAMPLES[name]);

		// A drop (vuedraggable `change`) emits the current tree, as in Directus.
		wrapper.findComponent(Nodes).vm.$emit('change');
		expect(last()).toEqual(SAMPLES[name]);

		// The same filter given as a JSON string (raw value of a json field) reads the same.
		const fromString = setup(JSON.stringify(SAMPLES[name]));
		fromString.wrapper.findComponent(Nodes).vm.$emit('change');
		expect(fromString.last()).toEqual(SAMPLES[name]);
	});

	test.each(Object.keys(BUILD) as (keyof typeof BUILD)[])(
		'the Directus steps of "%s" give the same JSON',
		async (name) => {
			const s = setup();
			await BUILD[name](s);
			expect(s.last()).toEqual(SAMPLES[name]);
		},
	);

	test('shows the rules: field names, functions, relational paths, operators, values', () => {
		const { wrapper } = setup({
			_and: [SAMPLES.year._and[0], SAMPLES.authorName._and[0], SAMPLES.bodyNull._and[0], SAMPLES.orGroup._and[0]],
		});

		const headers = wrapper.findAll('.rule-header').map((h) => h.text().replace(/\s+/g, ' '));
		expect(headers[0]).toContain('Year (Date Published)');
		expect(headers[0]).toContain('Equals');
		expect((wrapper.findAll('input[type="text"]')[0]!.element as HTMLInputElement).value).toBe('2024');
		expect(headers[1]).toContain('Author -> First Name');
		expect(headers[1]).toContain('Contains');
		expect(headers[2]).toContain('Is null');
		expect(headers[3]).toContain('OR');
		expect(headers[3]).toContain('— Any of the following');
		expect(headers[4]).toContain('Status');
	});

	test('AND / OR switch, removal at any depth, empty filter emits null', async () => {
		const s = setup(SAMPLES.orGroup);

		await s.wrapper.get('.logic-key').trigger('click');
		expect(s.last()).toEqual({ _and: [{ _and: SAMPLES.orGroup._and[0]!._or }] });
		await s.sync();

		// Remove Title inside the group, then the group.
		await s.wrapper.findAll('.delete')[2]!.trigger('click');
		expect(s.last()).toEqual({ _and: [{ _and: [{ status: { _eq: 'draft' } }] }] });
		await s.sync();
		await s.wrapper.findAll('.delete')[0]!.trigger('click');
		expect(s.last()).toBeNull();
	});

	test('while a rule is dragged the groups show their drop frame (D-170)', async () => {
		const s = setup(SAMPLES.orGroup);
		const lists = s.wrapper.findAllComponents({ name: 'draggable' });
		const nested = s.wrapper.findAll('ul.group')[1]!;

		expect(nested.classes()).toContain('in-[.bo-filter-dragging]:outline-dashed');
		expect(document.body.classList.contains('bo-filter-dragging')).toBe(false);
		lists[1]!.vm.$emit('start', {});
		expect(document.body.classList.contains('bo-filter-dragging')).toBe(true);
		lists[1]!.vm.$emit('end', {});
		expect(document.body.classList.contains('bo-filter-dragging')).toBe(false);

		lists[0]!.vm.$emit('start', {});
		s.wrapper.unmount();
		expect(document.body.classList.contains('bo-filter-dragging')).toBe(false);
	});

	test('And / Or group from the add menu; the field list holds readable fields only', async () => {
		const s = setup();
		await openAddFilter(s);
		const tree = [...document.body.querySelectorAll('[role="treeitem"][aria-level="1"]')].map((el) =>
			el.querySelector('.truncate')?.textContent?.trim(),
		);
		expect(tree).toEqual(
			useFieldsStore()
				.getFieldsForCollectionSorted('bo_content')
				.filter((f) => !f.meta?.special?.includes('alias') && !f.meta?.special?.includes('no-data'))
				.map((f) => f.name),
		);

		(document.body.querySelector('.add-group') as HTMLElement).click();
		expect(s.last()).toEqual({ _and: [{ _and: [] }] });
	});

	test('changing the operator keeps or converts the value like Directus', async () => {
		const s = setup({ _and: [{ sort: { _eq: '3' } }] });

		await operator(s, 0, 'Is one of');
		expect(s.last()).toEqual({ _and: [{ sort: { _in: ['3'] } }] });
		await operator(s, 0, 'Is null');
		expect(s.last()).toEqual({ _and: [{ sort: { _null: true } }] });
		await operator(s, 0, 'Equals');
		expect(s.last()).toEqual({ _and: [{ sort: { _eq: null } }] });
	});

	test('changing the field of a rule (field button → FieldList)', async () => {
		const s = setup(SAMPLES.title);
		await s.wrapper.get('.rule-header .field-button').trigger('click');
		await flushPromises();
		treeItem('Body').click();
		// Title (string) → Body (text): another type, so the first operator of the new type and no value.
		expect(s.last()).toEqual({ _and: [{ body: { _contains: null } }] });
	});

	test('D-69: Move up / Move down give the same JSON as the Directus drag', async () => {
		const s = setup({ _and: [{ _or: [{ title: { _contains: 'Content' } }] }, { status: { _eq: 'draft' } }] });

		const menuOf = (index: number) =>
			s.wrapper.findComponent(Nodes).element.querySelectorAll(':scope > ul > li > div > .rule-header .row-menu')[
				index
			]!;
		await chooseMenuItem(menuOf(1), 'Move up');
		expect(s.last()).toEqual(SAMPLES.reordered);
		await s.sync();
		expect(s.wrapper.findComponent(Nodes).element.querySelector(':scope > [aria-live="polite"]')!.textContent).toBe(
			'Status moved to position 1 of 2',
		);

		await chooseMenuItem(menuOf(0), 'Move down');
		expect(s.last()).toEqual({ _and: [{ _or: [{ title: { _contains: 'Content' } }] }, { status: { _eq: 'draft' } }] });
	});

	test('inline mode hides the empty list; collection notices', () => {
		expect(setup(null, { inline: true }).wrapper.text()).not.toContain('No configured rules');
		expect(setup(null).wrapper.text()).toContain('No configured rules');
		expect(setup(null, { collectionName: undefined }).wrapper.text()).toContain(
			'The collection field option is misconfigured',
		);
	});

	test('invalid values for the type are not emitted, dynamic variables are', async () => {
		const s = setup({ _and: [{ id: { _eq: null } }] });
		const input = s.wrapper.get('input[type="text"]');

		await input.setValue('abc');
		expect(s.wrapper.emitted('input')).toBeUndefined();

		await input.setValue('$CURRENT_ROLE');
		expect(s.last()).toEqual({ _and: [{ id: { _eq: '$CURRENT_ROLE' } }] });
	});
});
