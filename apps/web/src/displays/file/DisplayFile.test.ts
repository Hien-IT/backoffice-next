// Directus has no test for the file display: thumbnail URL (FR-077), SVG raw asset, extension badge, image error.
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mockApi } from '../../test-utils/fetch.ts';
import { itemOf } from '../../test-utils/fixtures.ts';
import DisplayFile from './DisplayFile.vue';
import display from './index.ts';

const pdf = itemOf('bo_rel', 1)['file'];
const png = itemOf('bo_rel', 1)['file_image'];

beforeEach(() => {
	vi.unstubAllGlobals();
	mockApi({});
});

const mountDisplay = (value: unknown) => mount(DisplayFile, { props: { value } as never });

describe('file display', () => {
	test('fields needed from the related file', () => {
		expect(display.fields).toEqual(['id', 'type', 'title', 'modified_on']);
	});

	test('image: system-small-cover thumbnail with the modified_on cache buster', () => {
		const img = mountDisplay({ ...png, modified_on: '2024-01-02T03:04:05.000Z' }).get('img');
		const url = new URL(img.attributes('src')!);

		expect(url.pathname).toBe(`/assets/${png.id}`);
		expect(url.searchParams.get('key')).toBe('system-small-cover');
		expect(url.searchParams.get('v')).toBe('2024-01-02T03:04:05.000Z');
		expect(img.attributes('alt')).toBe(png.title);
	});

	test('svg: the raw asset, no preset', () => {
		const img = mountDisplay({ id: 'bo-5', type: 'image/svg+xml', title: 'svg', modified_on: null }).get('img');

		expect(new URL(img.attributes('src')!).search).toBe('');
		expect(img.classes()).toContain('is-svg');
	});

	test('not an image: extension badge', () => {
		const wrapper = mountDisplay(pdf);

		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.get('.extension').text()).toBe('pdf');
		expect(wrapper.get('.extension').classes()).toContain('uppercase');
	});

	test('image that fails to load: extension badge', async () => {
		const wrapper = mountDisplay(png);
		await wrapper.get('img').trigger('error');

		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.get('.extension').text()).toBe('png');
	});

	test('unknown type: folder icon', () => {
		const wrapper = mountDisplay({ id: 'x', type: 'application/x-unknown', title: 'x', modified_on: null });

		expect(wrapper.get('.preview').text()).toBe('folder_open');
	});
});
