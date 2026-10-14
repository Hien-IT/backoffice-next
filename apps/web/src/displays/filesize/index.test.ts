// Directus has no test for the filesize display: component and handler use formatFilesize.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';

test('component and handler format bytes', () => {
	const value = itemOf('bo_std', 1)['filesize'];

	expect(mount(config.component, { props: { value } }).html()).toBe('<span>123.5 kB</span>');
	expect(config.handler!(value, {}, {})).toBe('123.5 kB');
	expect(config.handler!(512, {}, {})).toBe('512 B');
	expect(config.handler!(0, {}, {})).toBe('--');
});
