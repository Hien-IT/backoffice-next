// T094 (FR-094, SC-005, contracts/tests.md §5.6): every interface group of the fixture forms works with the keyboard
// alone, in BoForm with the seeded items: text, number, date, select, tags, relational, file, list, groups and the
// third-party editors (reach and leave them with Tab). Interface-level keyboard tests stay next to each interface
// (SelectDropdown, BoTagsInput, ListM2A, ListO2MTreeView Indent/Outdent, InputRichTextMd shortcuts...).
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import BoForm from './BoForm.vue';

enableAutoUnmount(afterEach);

const snapshot = loadSnapshot();
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(snapshot);
	await useUserStore().hydrate();
	await Promise.all([
		useFieldsStore().hydrate(),
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePermissionsStore().hydrate(),
	]);
});

afterEach(() => {
	for (const button of document.querySelectorAll('body > button')) button.remove();
	// MapLibre fetches the OpenStreetMap tiles with Request objects (outside the API; the map edge case of the spec).
	const api = fetch.mock.calls.filter(([input]) => !(input instanceof Request));
	assertOnlyKnownRequests(calls({ mock: { calls: api } } as typeof fetch));
});

/**
 * Mounts BoForm with the seeded first item of `collection`, either every field or only `names` (then a "Before"
 * button precedes the form and has the focus, so the first Tab enters the first field). Field menus are off so the
 * Tab order is the interfaces'.
 */
async function mountForm(collection: string, names?: string[]) {
	const item = snapshot.items[collection]![0]!;
	const before = document.body.appendChild(document.createElement('button'));
	before.textContent = 'Before';

	const fields =
		names &&
		useFieldsStore()
			.getFieldsForCollection(collection)
			.filter((f) => names.includes(f.field));

	const wrapper = mount(BoForm, {
		props: {
			...(fields ? { fields } : { collection }),
			primaryKey: item['id'] as number,
			initialValues: item,
			modelValue: {},
			disabledMenu: true,
			'onUpdate:modelValue': (edits: Record<string, unknown>) => wrapper.setProps({ modelValue: edits }),
		},
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});

	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 200));
	before.focus();

	const edits = () => wrapper.emitted<[Record<string, unknown>]>('update:modelValue')?.at(-1)?.[0] ?? {};
	return { wrapper, before, edits };
}

const active = () => document.activeElement as HTMLElement;
const fieldOf = (el: Element | null) => el?.closest('[data-field]')?.getAttribute('data-field');
const dialog = () => document.querySelector('[role="dialog"]');

/** Opens the menu of the focused trigger with Enter and runs `item` with the arrow keys and Enter. */
async function chooseInMenu(item: string) {
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());

	for (let i = 0; i < 10 && !active().textContent?.includes(item); i++) await userEvent.keyboard('{ArrowDown}');

	expect(active().textContent).toContain(item);
	await userEvent.keyboard('{Enter}');
}

/** Enter on the focused button opens a drawer; Esc closes it and the focus returns to the button. */
async function drawerRoundTrip() {
	const trigger = active();

	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(dialog()).not.toBeNull());
	await vi.waitFor(() => expect(dialog()!.contains(active())).toBe(true));

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(dialog()).toBeNull());
	await vi.waitFor(() => expect(active()).toBe(trigger));
}

describe('text, number, date, select', () => {
	test('Tab enters the text and number inputs; typing and ArrowUp edit them', async () => {
		const { edits } = await mountForm('bo_std', ['input_string', 'input_integer']);

		await userEvent.tab();
		expect(fieldOf(active())).toBe('input_string');
		await userEvent.keyboard('{End}x');
		expect(edits()).toEqual({ input_string: 'alphax' });

		await userEvent.tab();
		expect(fieldOf(active())).toBe('input_integer');
		await userEvent.keyboard('{ArrowUp}');
		// step 5 of the field options
		await vi.waitFor(() => expect(edits()).toEqual({ input_string: 'alphax', input_integer: 60 }));
	});

	test('datetime: Enter opens the picker, the arrows and Enter pick a day, Esc closes and the focus returns', async () => {
		const { edits } = await mountForm('bo_std', ['date']);

		await userEvent.tab();
		const trigger = active();
		expect(fieldOf(trigger)).toBe('date');

		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()).not.toBeNull());
		await vi.waitFor(() => expect(dialog()!.contains(active())).toBe(true));
		// The selected day has the focus (APG date picker), the arrows move by day.
		expect(active().getAttribute('data-value')).toBe('2024-03-15');

		await userEvent.keyboard('{ArrowRight}');
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(edits()).toEqual({ date: '2024-03-16' }));
		// a date-only field closes on pick, like DR
		await vi.waitFor(() => expect(dialog()).toBeNull());
		await vi.waitFor(() => expect(active()).toBe(trigger));

		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()).not.toBeNull());
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		await vi.waitFor(() => expect(active()).toBe(trigger));
	});

	test('select-dropdown: Enter opens, ArrowDown and Enter select, Esc closes and the focus returns', async () => {
		const { edits } = await mountForm('bo_std', ['select_dropdown_int']);

		await userEvent.tab();
		const trigger = active();
		expect(fieldOf(trigger)).toBe('select_dropdown_int');

		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull());
		await vi.waitFor(() => expect(active().getAttribute('role')).toBe('option'));
		await userEvent.keyboard('{ArrowUp}');
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(edits()).toEqual({ select_dropdown_int: 1 }));
		await vi.waitFor(() => expect(active()).toBe(trigger));

		await userEvent.keyboard(' ');
		await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull());
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).toBeNull());
		await vi.waitFor(() => expect(active()).toBe(trigger));
	});
});

test('tags: Enter and comma add a tag, Backspace in the empty input removes the last one', async () => {
	const { edits } = await mountForm('bo_std', ['tags']);
	const tags = () => edits()['tags'] as string[];

	await userEvent.tab();
	expect(fieldOf(active())).toBe('tags');

	await userEvent.keyboard('delta{Enter}');
	await vi.waitFor(() => expect(tags()).toContain('delta'));
	await userEvent.keyboard('echo,');
	await vi.waitFor(() => expect(tags()).toContain('echo'));

	const before = tags().length;
	await userEvent.keyboard('{Backspace}{Backspace}');
	await vi.waitFor(() => expect(tags()).toHaveLength(before - 1));
});

describe('relational, file, list', () => {
	test('m2m: Tab to Add Existing, Enter opens the drawer, Esc closes it, the row menu moves a row down', async () => {
		const { edits } = await mountForm('bo_rel', ['m2m_list']);
		await vi.waitFor(() => expect(document.querySelectorAll('[aria-label^="Options for"]').length).toBe(3));

		while (!active().textContent?.includes('Add Existing')) await userEvent.tab();
		expect(fieldOf(active())).toBe('m2m_list');
		await drawerRoundTrip();

		document.querySelector<HTMLElement>('[aria-label="Options for Target five"]')!.focus();
		await chooseInMenu('Move up');
		await vi.waitFor(() => expect(edits()['m2m_list']).toBeDefined());
		expect(JSON.stringify(edits()['m2m_list'])).toContain('"sort"');
	});

	test('m2m: Remove Item with Enter deselects a row', async () => {
		const { edits } = await mountForm('bo_rel', ['m2m_list']);
		await vi.waitFor(() => expect(document.querySelectorAll('[aria-label="Remove Item"]').length).toBe(3));

		document.querySelector<HTMLElement>('[aria-label="Remove Item"]')!.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(JSON.stringify(edits()['m2m_list'])).toMatch(/"delete":\[\d+\]/));
	});

	test('files: Tab to Add Existing, Enter opens the file drawer, Esc closes it', async () => {
		await mountForm('bo_rel', ['files']);
		await vi.waitFor(() => expect(document.querySelectorAll('[aria-label^="Options for"]').length).toBe(2));

		while (!active().textContent?.includes('Add Existing')) await userEvent.tab();
		expect(fieldOf(active())).toBe('files');
		await drawerRoundTrip();
	});

	test('list: Tab to Add row, Enter opens the row drawer, Esc closes it; Enter on a row opens it', async () => {
		await mountForm('bo_std', ['list']);

		while (!active().textContent?.includes('Add row')) await userEvent.tab();
		expect(fieldOf(active())).toBe('list');
		await drawerRoundTrip();

		document.querySelector<HTMLElement>('[data-field="list"] .row-open')!.focus();
		await drawerRoundTrip();
	});

	test('list: "View Raw Value" in the row menu shows the row JSON, Esc closes it (D-197)', async () => {
		await mountForm('bo_std', ['list']);
		await vi.waitFor(() => expect(document.querySelector('[aria-label="Options for Row B (1)"]')).not.toBeNull());

		const trigger = document.querySelector<HTMLElement>('[aria-label="Options for Row B (1)"]')!;
		trigger.focus();
		await chooseInMenu('View Raw Value');
		await vi.waitFor(() => expect(dialog()?.textContent).toContain('"title": "Row B"'));

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		await vi.waitFor(() => expect(active()).toBe(trigger));
	});
});

describe('groups', () => {
	test('tabs: the arrows move between the tabs and select them', async () => {
		await mountForm('bo_groups');
		const tabs = () => [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
		const first = tabs().find((tab) => tab.textContent?.includes('Tab One'))!;

		first.focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(active()).not.toBe(first);
		expect(active().getAttribute('role')).toBe('tab');
		await vi.waitFor(() => expect(active().getAttribute('aria-selected')).toBe('true'));
		expect(first.getAttribute('aria-selected')).toBe('false');
	});

	test('accordion and detail: Enter and Space toggle a section', async () => {
		await mountForm('bo_groups');
		const header = (text: string) =>
			[...document.querySelectorAll<HTMLElement>('button[aria-expanded]')].find((b) => b.textContent?.includes(text))!;

		for (const text of ['Acc Text', 'Detail']) {
			const button = header(text);
			const expanded = button.getAttribute('aria-expanded');
			const toggled = expanded === 'true' ? 'false' : 'true';

			button.focus();
			await userEvent.keyboard('{Enter}');
			await vi.waitFor(() => expect(header(text).getAttribute('aria-expanded')).toBe(toggled));
			await userEvent.keyboard(' ');
			await vi.waitFor(() => expect(header(text).getAttribute('aria-expanded')).toBe(expanded));
		}
	});
});

describe('third-party editors', () => {
	// input-code (CodeMirror 5) keeps Tab for indentation like DR (input-code.vue has no Tab key override), so
	// Tab does not leave a code field; the design owner decides whether to change it (T094 report).
	test('code: Tab reaches the CodeMirror input', async () => {
		await mountForm('bo_std', ['code_json']);
		await vi.waitFor(() => expect(document.querySelector('[data-field="code_json"] .CodeMirror')).not.toBeNull());

		await userEvent.tab();
		expect(fieldOf(active())).toBe('code_json');
		expect(active().closest('.CodeMirror')).not.toBeNull();
	});

	test('markdown: Tab reaches the toolbar, Shift+Tab from the toolbar leaves the editor', async () => {
		const { before } = await mountForm('bo_std', ['rich_md']);
		// The editor is a lazy chunk: on a loaded runner its toolbar appears later than the mount (016 CI).
		await vi.waitFor(
			() =>
				expect(
					document.querySelector('[data-field="rich_md"] button, [data-field="rich_md"] [tabindex="0"]'),
				).not.toBeNull(),
			{ timeout: 10_000 },
		);
		before.focus();

		await userEvent.tab();
		expect(fieldOf(active())).toBe('rich_md');
		await userEvent.tab({ shift: true });
		expect(active()).toBe(before);
	});

	test('block editor: Tab reaches the blocks and leaves them (no focus trap)', async () => {
		const { before } = await mountForm('bo_std', ['block_editor']);
		const after = document.body.appendChild(document.createElement('button'));
		// Editor.js shows an empty block, then replaces it with the value and resolves render() in an idle callback: wait
		// for the last seeded block and for one idle callback of ours (they run in order), or the focus lands on a block
		// that render() then removes (slow CI runners).
		await vi.waitFor(
			() =>
				expect(document.querySelector('[data-field="block_editor"] .ce-block[data-id="bo-block-3"]')).not.toBeNull(),
			{
				timeout: 10_000,
			},
		);
		await new Promise((resolve) => requestIdleCallback(resolve));
		before.focus();

		await userEvent.tab();
		expect(fieldOf(active())).toBe('block_editor');
		for (let i = 0; i < 10 && active() !== after; i++) await userEvent.tab();
		expect(active()).toBe(after);
	});

	test('map: Tab reaches the map and leaves it through its controls (no focus trap)', async () => {
		const { before } = await mountForm('bo_std', ['map_text']);
		const after = document.body.appendChild(document.createElement('button'));
		await vi.waitFor(() => expect(document.querySelector('[data-field="map_text"] canvas')).not.toBeNull());
		before.focus();

		await userEvent.tab();
		expect(active().getAttribute('aria-label')).toBe('Map');
		for (let i = 0; i < 20 && active() !== after; i++) await userEvent.tab();
		expect(active()).toBe(after);
	});
});
