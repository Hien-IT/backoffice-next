// DR has no test for the labels display (spec FR-074, FR-079): chips, dots, format, choices, handler.
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import DisplayLabels from './DisplayLabels.vue';

const global = { plugins: [i18n] };

function mountLabels(props: Record<string, unknown>) {
	return mount(DisplayLabels, { props: { type: 'string', ...props } as never, global });
}

const chips = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.display-labels > span');

describe('chips', () => {
	test('a string, a number and an array render one chip per value', () => {
		expect(chips(mountLabels({ value: 'draft' })).map((c) => c.text())).toEqual(['Draft']);
		expect(chips(mountLabels({ value: 2, type: 'integer' })).map((c) => c.text())).toEqual(['2']);
		expect(chips(mountLabels({ value: ['a_b', 'c'], type: 'json' })).map((c) => c.text())).toEqual(['A B', 'C']);
		expect(chips(mountLabels({ value: [], type: 'json' }))).toHaveLength(0);
	});

	test('option:labels.format formats the text by default and not when false', () => {
		expect(mountLabels({ value: 'in_review' }).text()).toBe('In Review');
		expect(mountLabels({ value: 'in_review', format: false }).text()).toBe('in_review');
	});

	test('option:labels.choices sets the text, icon and colors of a matching value', () => {
		const wrapper = mountLabels({
			value: 'alpha',
			choices: [{ text: 'Alpha!', value: 'alpha', icon: 'star', foreground: '#FFFFFF', background: '#6644FF' }],
		});
		const chip = chips(wrapper)[0]!;

		expect(chip.text()).toBe('starAlpha!');
		expect(chip.attributes('style')).toBe('color: #FFFFFF; background-color: #6644FF;');
	});

	test('option:labels.choices color colors the icon, or shows a dot before the text without an icon', () => {
		const wrapper = mountLabels({
			value: ['alpha', 'beta'],
			type: 'json',
			choices: [
				{ text: 'Alpha', value: 'alpha', icon: 'star', color: '#6644FF' },
				{ text: 'Beta', value: 'beta', color: '#2ECDA7' },
			],
		});
		const [alpha, beta] = chips(wrapper);

		expect(alpha!.get('.material-symbols-rounded').attributes('style')).toContain('color: #6644FF');
		expect(alpha!.find('.dot').exists()).toBe(false);
		expect(beta!.get('.dot').attributes('style')).toBe('background-color: #2ECDA7;');
		expect(beta!.text()).toBe('Beta');
	});

	test('a value without a choice keeps the theme chip colors', () => {
		const chip = chips(mountLabels({ value: 'other', choices: [{ text: 'A', value: 'a' }] }))[0]!;

		expect(chip.attributes('style')).toBeUndefined();
		expect(chip.classes()).toContain('bg-gray-100');
	});
});

describe('dots', () => {
	test('option:labels.showAsDot shows a dot per value with the choice color and the text for screen readers', () => {
		const wrapper = mountLabels({
			value: ['alpha', 'beta', 'gamma'],
			type: 'json',
			showAsDot: true,
			choices: [
				{ text: 'Alpha', value: 'alpha', color: '#6644FF', background: '#000000' },
				{ text: 'Beta', value: 'beta', background: '#2ECDA7' },
			],
		});

		expect(wrapper.findAll('.dot').map((dot) => dot.attributes('style'))).toEqual([
			'background-color: #6644FF;',
			'background-color: #2ECDA7;',
			'background-color: var(--color-gray-100);',
		]);
		expect(wrapper.get('.sr-only').text()).toBe('Alpha, Beta, Gamma');
		expect(chips(wrapper).filter((c) => !c.classes('sr-only'))).toHaveLength(0);
	});
});

describe('handler', () => {
	test('uses the display choices, then the interface choices, then the value', () => {
		const options = { choices: [{ text: 'Alpha', value: 'alpha' }] };
		const interfaceOptions = { choices: [{ text: 'Beta', value: 'beta' }] };

		expect(config.handler!(['alpha', 'beta', 'gamma'], options, { interfaceOptions })).toBe('Alpha, Beta, gamma');
		expect(config.handler!('beta', {}, { interfaceOptions })).toBe('Beta');
		expect(config.handler!(3, {}, {})).toBe(3);
	});
});

describe('fixture fields', () => {
	const field = (name: string) => fieldsOf('bo_std').find((f) => f.field === name)!;
	const item = itemOf('bo_std', 1);
	const render = (name: string) =>
		mountLabels({ ...field(name).meta!.display_options, type: field(name).type, value: item[name] });

	test('bo_std.tags, tags_csv, select_dropdown, select_dropdown_int, select_multiple_dropdown', () => {
		expect(chips(render('tags')).map((c) => c.text())).toEqual(['Alpha', 'custom-tag']);
		expect(chips(render('tags_csv')).map((c) => c.text())).toEqual(['One', 'Two']);
		expect(render('select_dropdown').findAll('.dot')).toHaveLength(1);
		expect(render('select_dropdown').get('.sr-only').text()).toBe('Alpha');
		expect(chips(render('select_dropdown_int')).map((c) => c.text())).toEqual(['2']);
		expect(chips(render('select_multiple_dropdown')).map((c) => c.text())).toEqual(['Beta', 'starAlpha']);
	});
});
