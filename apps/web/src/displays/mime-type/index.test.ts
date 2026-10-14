// Directus has no test for the mime-type display: readable name, or the extension with showAsExtension.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';

const render = (props: Record<string, unknown>) => mount(config.component, { props }).text();

test('shows the readable mime type by default', () => {
	expect(render({ value: 'image/png' })).toBe('PNG');
	expect(config.handler!('image/png', {}, {})).toBe('PNG');
});

test('option:mime-type.showAsExtension shows the extension', () => {
	expect(render({ value: 'application/pdf', showAsExtension: true })).toBe('pdf');
	expect(config.handler!('application/pdf', { showAsExtension: true }, {})).toBe('pdf');
});

test('option:mime-type.showAsExtension uses the mime extension table like Directus', () => {
	expect(render({ value: 'application/octet-stream', showAsExtension: true })).toBe('bin');
	expect(config.handler!('application/octet-stream', { showAsExtension: true }, {})).toBe('bin');
});

test('fixture field bo_std.mime', () => {
	const field = fieldsOf('bo_std').find((f) => f.field === 'mime')!;

	expect(render({ ...field.meta!.display_options, value: itemOf('bo_std', 1)['mime'] })).toBe('png');
});
