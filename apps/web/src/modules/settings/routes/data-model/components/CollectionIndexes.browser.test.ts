// Backoffice (spec 030, T052, T059, T063, contracts/web.md): the Indexes card in chromium with the composable mocked:
// hidden when unavailable, the rows and their states, the add dialog (field select into a sortable list, keyboard
// reorder, trigram rules, concurrent switch), errors inline, delete with confirmation and focus back, keyboard-only
// flow, axe.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionIndex, IndexBody } from '../../../../../composables/use-collection-indexes.ts';
import { i18n } from '../../../../../lang/index.ts';
import '../../../../../styles/index.css';
import { useFieldsStore } from '../../../../../stores/fields.ts';
import CollectionIndexes from './CollectionIndexes.vue';

const state = vi.hoisted(() => ({
	available: true,
	meta: { trigram: true, concurrent: true },
	rows: [] as any[],
	create: undefined as any,
	remove: undefined as any,
	load: undefined as any,
}));

vi.mock('../../../../../composables/use-collection-indexes.ts', async (original) => {
	const actual = await original<typeof import('../../../../../composables/use-collection-indexes.ts')>();
	const { computed, ref } = await import('vue');
	const available = ref(state.available);
	const meta = ref(state.meta);
	const indexes = ref<CollectionIndex[]>(state.rows);
	state.create = vi.fn(async (body: IndexBody) => {
		const row = index({ id: `n${indexes.value.length}`, name: `bo_art_${body.fields.join('_')}_${body.type === 'trigram' ? 'trgm' : body.unique ? 'unique' : 'index'}`, ...body, status: 'creating' });
		indexes.value = [...indexes.value, row];
		return row;
	});
	state.remove = vi.fn(async (name: string) => {
		indexes.value = indexes.value.filter((r) => r.name !== name);
	});
	state.load = vi.fn(async () => {
		available.value = state.available;
		meta.value = state.meta;
		indexes.value = state.rows;
	});

	return {
		...actual,
		useCollectionIndexes: () => ({
			available,
			meta,
			indexes,
			loading: ref(false),
			error: ref(null),
			load: state.load,
			create: state.create,
			remove: state.remove,
			indexesOf: (field: string) => computed(() => indexes.value.filter((r) => r.fields.includes(field))).value,
		}),
	};
});

function index(over: Partial<CollectionIndex> & { fields: string[] }): CollectionIndex {
	return {
		id: 'i1',
		collection: 'bo_art',
		name: 'bo_art_provider_provider_subject_unique',
		type: 'btree',
		unique: true,
		status: 'ready',
		error: null,
		date_created: '2026-11-03T00:00:00.000Z',
		missing: false,
		...over,
	};
}

const field = (name: string, type: string, extra: Record<string, unknown> = {}) =>
	({
		collection: 'bo_art',
		field: name,
		name: name[0]!.toUpperCase() + name.slice(1),
		type,
		schema: { name },
		meta: { id: 1, field: name, special: null, ...extra },
	}) as never;

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useFieldsStore().fields = [
		field('id', 'integer'),
		field('provider', 'string'),
		field('provider_subject', 'string'),
		field('note', 'text'),
		field('payload', 'json'),
		{ ...(field('divider', 'alias', { special: ['alias', 'no-data'] }) as object), schema: null } as never,
	];
	state.available = true;
	state.meta = { trigram: true, concurrent: true };
	state.rows = [];
	state.create?.mockClear();
	state.remove?.mockClear();
});

function mountCard() {
	return mount(CollectionIndexes, { props: { collection: 'bo_art' }, global: { plugins: [i18n] }, attachTo: document.body });
}

const card = () => document.querySelector<HTMLElement>('[data-testid="collection-indexes"]');
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const buttonIn = (root: ParentNode | null, text: string) =>
	[...(root?.querySelectorAll('button') ?? [])].find((el) => el.textContent?.trim().endsWith(text));
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];

async function seriousViolations(root: Element) {
	const { violations } = await axe.run(root, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

/** Opens the first (fields) select of the dialog and picks the option whose text contains `text`. */
async function pickField(text: string) {
	const trigger = dialog()!.querySelector<HTMLButtonElement>('button[role="combobox"]')!;
	await userEvent.click(trigger);
	await vi.waitFor(() => expect(listbox()).not.toBeNull());
	await userEvent.click(options().find((o) => o.textContent!.includes(text))!);
	await vi.waitFor(() => expect(listbox()).toBeNull());
}

describe('visibility and rows', () => {
	test('hidden when the API has no indexes route; shown with the empty state and no axe violation', async () => {
		state.available = false;
		mountCard();
		await flushPromises();
		expect(card()).toBeNull();
	});

	test('rows with their fields, type, unique, status creating / ready / failed / missing', async () => {
		state.rows = [
			index({ fields: ['provider', 'provider_subject'] }),
			index({ id: 'i2', name: 'bo_art_note_trgm', fields: ['note'], type: 'trigram', unique: false, status: 'creating' }),
			index({ id: 'i3', name: 'bo_art_provider_index', fields: ['provider'], unique: false, status: 'failed', error: 'boom' }),
			index({ id: 'i4', name: 'bo_art_note_index', fields: ['note'], unique: false, missing: true }),
		];
		mountCard();
		await flushPromises();

		expect(state.load).toHaveBeenCalled();
		const rows = [...card()!.querySelectorAll('tbody tr')];
		expect(rows).toHaveLength(4);
		expect(rows[0]!.textContent).toContain('Provider');
		expect(rows[0]!.textContent).toContain('Provider_subject');
		expect(rows[0]!.textContent).toContain('B-tree');
		expect(rows[0]!.textContent).toContain('Ready');
		expect(rows[1]!.textContent).toContain('Trigram');
		expect(rows[1]!.textContent).toContain('Creating');
		expect(rows[1]!.querySelector('button[aria-label^="Delete"]')).toHaveProperty('disabled', true);
		expect(rows[2]!.textContent).toContain('Failed: boom');
		expect(rows[3]!.textContent).toContain('Missing on the database');
		expect(await seriousViolations(card()!)).toEqual([]);
	});
});

describe('add', () => {
	test('fields go into a sortable list in order, Move up reorders by keyboard, unique on; Create posts the body', async () => {
		mountCard();
		await flushPromises();
		await userEvent.click(buttonIn(card(), 'Add index')!);
		await vi.waitFor(() => expect(dialog()).not.toBeNull());

		// Real columns only: no alias, no json for a btree? (json is refused by the API, offered here), no picked ones.
		await pickField('Provider_subject');
		await pickField('Provider');
		expect([...dialog()!.querySelectorAll('[data-row-key]')].map((r) => r.getAttribute('data-row-key'))).toEqual([
			'provider_subject',
			'provider',
		]);

		const trigger = dialog()!.querySelector<HTMLElement>('[aria-label="Options for Provider"]')!;
		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
		await userEvent.keyboard('{ArrowDown}');
		await vi.waitFor(() => expect(document.activeElement?.textContent).toContain('Move up'));
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() =>
			expect([...dialog()!.querySelectorAll('[data-row-key]')].map((r) => r.getAttribute('data-row-key'))).toEqual([
				'provider',
				'provider_subject',
			]),
		);

		await userEvent.click(dialog()!.querySelector<HTMLElement>('[role="switch"]')!);
		expect(await seriousViolations(dialog()!)).toEqual([]);
		await userEvent.click(buttonIn(dialog(), 'Create')!);

		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(state.create).toHaveBeenCalledWith(
			{ fields: ['provider', 'provider_subject'], type: 'btree', unique: true },
			true,
		);
		expect(card()!.textContent).toContain('bo_art_provider_provider_subject_unique');
		expect(card()!.textContent).toContain('Creating');
	});

	test('trigram keeps one string field, turns unique off; the type is absent without meta.trigram; concurrent off', async () => {
		mountCard();
		await flushPromises();
		await userEvent.click(buttonIn(card(), 'Add index')!);
		await vi.waitFor(() => expect(dialog()).not.toBeNull());
		await pickField('Provider');
		await pickField('Note');

		const selects = dialog()!.querySelectorAll<HTMLButtonElement>('button[role="combobox"]');
		await userEvent.click(selects[1]!);
		await vi.waitFor(() => expect(listbox()).not.toBeNull());
		await userEvent.click(options().find((o) => o.textContent!.includes('Trigram'))!);
		await vi.waitFor(() => expect(listbox()).toBeNull());

		expect([...dialog()!.querySelectorAll('[data-row-key]')].map((r) => r.getAttribute('data-row-key'))).toEqual([
			'provider',
		]);
		const switches = dialog()!.querySelectorAll<HTMLButtonElement>('[role="switch"]');
		expect(switches[0]!.getAttribute('aria-checked')).toBe('false');
		expect(switches[0]!.disabled).toBe(true);
		await userEvent.click(switches[1]!);
		await userEvent.click(buttonIn(dialog(), 'Create')!);
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(state.create).toHaveBeenCalledWith({ fields: ['provider'], type: 'trigram', unique: false }, false);
	});

	test('without meta.trigram and meta.concurrent: one type, no concurrent switch; an API error shows inline', async () => {
		state.meta = { trigram: false, concurrent: false };
		mountCard();
		await flushPromises();
		await userEvent.click(buttonIn(card(), 'Add index')!);
		await vi.waitFor(() => expect(dialog()).not.toBeNull());

		const selects = dialog()!.querySelectorAll<HTMLButtonElement>('button[role="combobox"]');
		await userEvent.click(selects[1]!);
		await vi.waitFor(() => expect(listbox()).not.toBeNull());
		// The chosen option carries the "check" ligature of its icon.
		expect(options().map((o) => o.textContent!.replace(/check$/, '').trim())).toEqual(['B-tree']);
		await userEvent.keyboard('{Escape}');
		expect(dialog()!.querySelectorAll('[role="switch"]')).toHaveLength(1);

		await pickField('Payload');
		state.create.mockRejectedValueOnce({
			errors: [
				{
					message: 'Invalid payload. Field "payload" of type json cannot be indexed.',
					extensions: { code: 'INVALID_PAYLOAD', reason: 'Field "payload" of type json cannot be indexed' },
				},
			],
		});
		await userEvent.click(buttonIn(dialog(), 'Create')!);
		await vi.waitFor(() => expect(dialog()!.textContent).toContain('cannot be indexed'));
		expect(dialog()).not.toBeNull();
	});

	test('keyboard only: Tab to Add index, Enter, pick with the arrows, Enter on Create', async () => {
		mountCard();
		await flushPromises();
		buttonIn(card(), 'Add index')!.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()).not.toBeNull());

		const trigger = dialog()!.querySelector<HTMLButtonElement>('button[role="combobox"]')!;
		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(listbox()).not.toBeNull());
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()!.querySelector('[data-row-key]')).not.toBeNull());

		buttonIn(dialog(), 'Create')!.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(state.create).toHaveBeenCalledTimes(1);
	});
});

describe('delete', () => {
	test('the confirmation names the index, Cancel first; Delete removes it and focus returns to the row button', async () => {
		state.rows = [index({ fields: ['provider', 'provider_subject'] })];
		mountCard();
		await flushPromises();

		const trigger = card()!.querySelector<HTMLButtonElement>('button[aria-label^="Delete"]')!;
		await userEvent.click(trigger);
		await vi.waitFor(() => expect(dialog()).not.toBeNull());
		expect(dialog()!.textContent).toContain('bo_art_provider_provider_subject_unique');
		const buttons = [...dialog()!.querySelectorAll('button')].map((b) => b.textContent!.trim());
		expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Delete'));

		await userEvent.click(buttonIn(dialog(), 'Delete')!);
		await vi.waitFor(() => expect(dialog()).toBeNull());
		expect(state.remove).toHaveBeenCalledWith('bo_art_provider_provider_subject_unique');
		expect(card()!.textContent).toContain('No indexes yet');
	});
});
