// DR has no test for the raw display: strings as-is, everything else as JSON.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';

const render = (value: unknown) => mount(config.component, { props: { value } }).text();

test('a string renders as-is, other values as JSON', () => {
	expect(render('<b>hi</b>')).toBe('<b>hi</b>');
	expect(render(42)).toBe('42');
	expect(render(true)).toBe('true');
	expect(render({ a: [1, 2] })).toBe('{"a":[1,2]}');
});

test('fixture fields of bo_std that use raw', () => {
	const item = itemOf('bo_std', 1);

	expect(render(item['input_biginteger'])).toBe(String(item['input_biginteger']));
	expect(render(item['select_radio'])).toBe(item['select_radio']);
});

test('accepts every type and local type', () => {
	expect(config.types).toHaveLength(25);
	expect(config.localTypes).toContain('presentation');
	expect(config.options).toEqual([]);
});
