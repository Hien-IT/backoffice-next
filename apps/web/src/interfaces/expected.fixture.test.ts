// T045 (SC-002, contracts/tests.md §5.4): every scenario of fixtures/interfaces/snapshot/expected.<id>.json mounts the
// registered interface with the bo_std field's options and seeded value, runs the scenario's action and checks the
// last emitted `input` value against the hand-written Directus value.
import type CodeMirror from 'codemirror';
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../test-utils/fixtures.ts';
import { translate } from '../utils/translate-object-values.ts';
import { getInterface } from './index.ts';

enableAutoUnmount(afterEach);

const US1 = [
	'input',
	'input-multiline',
	'input-hash',
	'input-autocomplete-api',
	'boolean',
	'datetime',
	'slider',
	'tags',
	'input-code',
	'select-dropdown',
	'select-multiple-dropdown',
	'select-radio',
	'select-multiple-checkbox',
	'select-multiple-checkbox-tree',
	'select-icon',
	'select-color',
];

/** One scenario of expected.<id>.json; `value` is the expected emitted value (fixtures.ts ExpectedScenario). */
interface Scenario {
	field: string;
	initial: unknown;
	/** One step or several, each `<verb> <argument>` (see `run`). */
	action: string | string[];
	value: unknown;
	source: string;
}

const snapshot = loadSnapshot();
const fields = fieldsOf('bo_std');
const item = itemOf('bo_std', 1);
// The clock of every scenario ("set to now" of the date picker, verb `now`), in TZ=UTC.
const NOW = new Date('2025-01-02T03:04:05.000Z');

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(() => {
	setActivePinia(createPinia());
	vi.stubEnv('TZ', 'UTC');
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	fetch = mockFixtureApi(snapshot);
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

/** Mounts the interface like FormFieldInterface, with v-model on `input` like the form. */
function mountInterface(id: string, name: string, value: unknown) {
	const field = fields.find((f) => f.field === name)!;

	const wrapper: VueWrapper = mount(getInterface(id)!.component as never, {
		props: {
			...translate(field.meta?.options ?? {}),
			value,
			type: field.type,
			collection: field.collection,
			field: field.field,
			width: field.meta?.width ?? 'full',
			length: field.schema?.max_length ?? null,
			primaryKey: 1,
			onInput: (next: unknown) => wrapper.setProps({ value: next }),
		} as never,
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	return wrapper;
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve));
	await flushPromises();
}

/** Elements a click verb can target, by aria-label or by the end of their text (icons come first in the text). */
function clickable(text: string): HTMLElement {
	const candidates = [
		...document.body.querySelectorAll<HTMLElement>(
			'button, label, [role="checkbox"], [role="radio"], [role="treeitem"], [role="option"]',
		),
	];

	const found =
		candidates.find((el) => el.getAttribute('aria-label') === text) ??
		candidates.find((el) => el.textContent?.trim().endsWith(text));

	if (!found) throw new Error(`Nothing to click named "${text}"`);
	const target = found instanceof HTMLLabelElement && found.htmlFor ? document.getElementById(found.htmlFor) : found;
	return target ?? found;
}

const textControl = (wrapper: VueWrapper) =>
	wrapper.get<HTMLInputElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');

async function run(wrapper: VueWrapper, step: string) {
	const space = step.indexOf(' ');
	const verb = space === -1 ? step : step.slice(0, space);
	const arg = space === -1 ? '' : step.slice(space + 1);

	switch (verb) {
		// replaces the text of the first text input or textarea; an `input` event only, like typing (no `change`)
		case 'type': {
			const control = textControl(wrapper);
			control.element.value = arg;
			await control.trigger('input');
			break;
		}
		case 'blur':
			await textControl(wrapper).trigger('blur');
			break;
		// replaces the content of the CodeMirror editor like typing
		case 'code': {
			let editor!: CodeMirror.Editor;
			await vi.waitFor(() => {
				editor = (wrapper.element.querySelector('.CodeMirror') as unknown as { CodeMirror: CodeMirror.Editor })
					.CodeMirror;
				// Directus sets the 'javascript ' placeholder mode, then the language, then listens to changes.
				expect(editor.getOption('mode')).not.toEqual({ name: 'javascript ' });
			});
			await flushPromises();
			editor.execCommand('selectAll');
			editor.replaceSelection(arg, undefined, '+input');
			break;
		}
		case 'toggle':
			await wrapper.get('button').trigger('click');
			break;
		case 'click':
			clickable(arg).click();
			break;
		// keydown on the slider thumb
		case 'key':
			await wrapper.get('[role="slider"]').trigger('keydown', { key: arg });
			break;
		case 'add-tag': {
			const input = wrapper.get('input');
			await input.setValue(arg);
			input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
			break;
		}
		// opens the list with the keyboard and chooses the option
		case 'pick': {
			const trigger = wrapper.find('[role="combobox"]').exists()
				? wrapper.get('[role="combobox"]')
				: wrapper.get('button');
			trigger.element.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
			);
			await settle();
			const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find((el) =>
				el.textContent?.trim().endsWith(arg),
			);
			if (!option) throw new Error(`No option "${arg}"`);
			const before = wrapper.emitted('input')?.length ?? 0;
			option.click();
			await settle();
			// Reka ComboboxItem selects on click, SelectItem on Enter (or pointerup)
			if ((wrapper.emitted('input')?.length ?? 0) === before)
				option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
			break;
		}
		// the clear / remove / deselect button of the interface
		case 'clear':
			await wrapper.get('.clear-icon, .item-actions button, button[aria-label="Deselect"]').trigger('click');
			break;
		case 'now': {
			await wrapper.get('.datetime-trigger').trigger('click');
			await settle();
			[...document.querySelectorAll<HTMLButtonElement>('.calendar-today-button')].at(-1)!.click();
			break;
		}
		default:
			throw new Error(`Unknown action verb "${verb}"`);
	}

	await settle();
}

test('every US1 interface has an expected file with scenarios on bo_std fields', () => {
	expect(Object.keys(snapshot.expected)).toEqual(expect.arrayContaining(US1));
});

// The expected files of the other stories run in their own fixture tests (real drawers, form, browser editors).
const OTHERS = {
	'relations.fixture.test.ts (US3)': [
		'select-dropdown-m2o',
		'list-o2m',
		'list-m2m',
		'list-m2a',
		'list-o2m-tree-view',
		'translations',
		'collection-item-dropdown',
		'collection-item-multiple-dropdown',
	],
	'files.fixture.test.ts (US4)': ['file', 'file-image', 'files'],
	'rich.fixture.browser.test.ts (US5)': ['input-rich-text-md', 'input-block-editor', 'map', 'list'],
};

test('every expected.<id>.json is run by a fixture test', () => {
	expect(Object.keys(snapshot.expected).sort()).toEqual([...US1, ...Object.values(OTHERS).flat()].sort());
});

describe.each(US1)('expected.%s.json', (id) => {
	const scenarios = Object.entries((snapshot.expected[id] ?? {}) as unknown as Record<string, Scenario>);

	test.each(scenarios)('%s', async (_name, scenario) => {
		const field = fields.find((f) => f.field === scenario.field);
		expect(field?.meta?.interface, `bo_std.${scenario.field}`).toBe(id);
		expect(scenario.initial).toEqual(item[scenario.field]);

		const wrapper = mountInterface(id, scenario.field, scenario.initial);
		await settle();
		expect(wrapper.emitted('input'), 'no input on mount').toBeUndefined();

		for (const step of [scenario.action].flat()) await run(wrapper, step);

		expect(wrapper.emitted('input')?.at(-1)?.[0]).toEqual(scenario.value);
	});
});
