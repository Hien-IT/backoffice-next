// DR has no test for the formatted-json-value display (spec FR-074): template, "N items" menu, handler.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import FormattedJsonValue from './DisplayFormattedJsonValue.vue';
import config from './index.ts';

const global = { plugins: [i18n] };

afterEach(() => {
	document.body.innerHTML = '';
});

function mountDisplay(props: Record<string, unknown>) {
	return mount(FormattedJsonValue, { props, global, attachTo: document.body });
}

describe('FormattedJsonValue', () => {
	test('option:formatted-json-value.format renders the template with the value', () => {
		expect(mountDisplay({ value: { key: 'value' }, format: '{{key}}' }).text()).toBe('value');
	});

	test('without format micromustache stringifies the value as Directus does', () => {
		expect(mountDisplay({ value: { a: 1 } }).text()).toBe('[object Object]');
		expect(mountDisplay({ value: [1, 2] }).text()).toBe('2 Items');
	});

	test('null, an empty value or a render error shows ValueNull', () => {
		expect(mountDisplay({ value: null }).text()).toContain('--');
		expect(mountDisplay({ value: '' }).text()).toContain('--');
		expect(mountDisplay({ value: { a: 1 }, format: 7 }).text()).toContain('--');
	});

	test('one array item renders inline', () => {
		expect(mountDisplay({ value: [{ title: 'Only' }], format: '{{title}}' }).text()).toBe('Only');
	});

	test('several items show "N items" on a popover trigger (opening: FormattedJsonValue.browser.test.ts)', () => {
		const trigger = mountDisplay({ value: [{ title: 'Row A' }, { title: 'Row B' }], format: '{{title}}' }).get(
			'button',
		);

		expect(trigger.text()).toBe('2 Items');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('aria-expanded')).toBe('false');
	});

	test('the trigger click does not reach a parent (table row)', async () => {
		let parentClicks = 0;
		const host = document.createElement('div');
		host.addEventListener('click', () => parentClicks++);
		document.body.append(host);

		const wrapper = mount(FormattedJsonValue, {
			props: { value: [1, 2] },
			global,
			attachTo: host,
		});

		await wrapper.get('button').trigger('click');
		expect(parentClicks).toBe(0);
	});
});

describe('handler', () => {
	test('reproduces the Directus argument order: the value is the template, the format the view', () => {
		// Strings are rendered as templates against the format string, so they come back unchanged.
		expect(config.handler!(['a', 'b'], { format: '{{key}}' }, {})).toBe('a, b');
		// An object is not a template: micromustache throws, as in DR 11.17.4.
		expect(() => config.handler!({ key: 'value' }, { format: '{{key}}' }, {})).toThrow(TypeError);
	});

	test('without format the values are joined', () => {
		expect(config.handler!(['a', 'b'], {}, {})).toBe('a, b');
		expect(config.handler!('one', {}, {})).toBe('one');
	});
});

describe('fixture fields', () => {
	const field = (name: string) => fieldsOf('bo_std').find((f) => f.field === name)!;
	const item = itemOf('bo_std', 1);

	test('bo_std.code_json, list, map_json, select_tree', () => {
		const render = (name: string) => mountDisplay({ ...field(name).meta!.display_options, value: item[name] }).text();

		expect(render('code_json')).toBe('value');
		expect(render('list')).toBe('2 Items');
		expect(render('map_json')).toBe('[object Object]');
		expect(render('select_tree')).toBe('2 Items');
	});
});
