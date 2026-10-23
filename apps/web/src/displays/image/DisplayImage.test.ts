// DR has no test for the image display: thumbnail URL (FR-077), `circle`, error icon, null.
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { mockApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import DisplayImage from './DisplayImage.vue';

const field = fieldsOf('bo_rel').find((f) => f.field === 'file_image')!;
const png = itemOf('bo_rel', 1)['file_image'];

beforeEach(() => {
	vi.unstubAllGlobals();
	mockApi({});
});

const mountDisplay = (props: Record<string, unknown>) =>
	mount(DisplayImage, { props: props as never, global: { plugins: [i18n] } });

describe('image display', () => {
	test('fixture field: system-small-cover thumbnail, circle', () => {
		const img = mountDisplay({ ...field.meta!.display_options, value: { ...png, modified_on: '2024-05-06' } }).get(
			'img',
		);
		const url = new URL(img.attributes('src')!);

		expect(url.pathname).toBe(`/assets/${png.id}`);
		expect(url.searchParams.get('key')).toBe('system-small-cover');
		expect(url.searchParams.get('v')).toBe('2024-05-06');
		expect(img.attributes('alt')).toBe(png.title);
		expect(img.classes()).toContain('rounded-full');
	});

	test('option:image.circle defaults to false', () => {
		expect(mountDisplay({ value: png }).get('img').classes()).not.toContain('rounded-full');
	});

	test('load error shows the image icon', async () => {
		const wrapper = mountDisplay({ value: png });
		await wrapper.get('img').trigger('error');

		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.text()).toBe('image');
	});

	test('null value shows ValueNull', () => {
		expect(mountDisplay({ value: null }).get('.sr-only').text()).toBe('No value');
	});
});
