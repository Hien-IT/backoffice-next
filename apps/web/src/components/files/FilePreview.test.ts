import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import FilePreview from './FilePreview.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	createSdk('https://api.test/');
});

const image = {
	id: 'img',
	title: 'Cat',
	type: 'image/jpeg',
	modified_on: '2024-01-01T00:00:00Z',
	width: 800,
	height: 600,
};

function mountPreview(props: Record<string, unknown>) {
	return mount(FilePreview, { props: props as never, global: { plugins: [i18n] } });
}

test('image: asset URL with the preset and cacheBuster, alt from the title, a button outside a modal', async () => {
	const wrapper = mountPreview({ file: image });

	const img = wrapper.get('img');
	expect(img.attributes('src')).toBe('https://api.test/assets/img?key=system-large-contain&v=2024-01-01T00%3A00%3A00Z');
	expect(img.attributes('alt')).toBe('Cat');
	expect(img.attributes('style')).toContain('max-height: 528px');
	expect(wrapper.get('.image').classes()).toContain('animate-pulse');

	await wrapper.get('button').trigger('click');
	expect(wrapper.emitted('click')).toHaveLength(1);

	await img.trigger('load');
	expect(wrapper.get('.image').classes()).not.toContain('animate-pulse');
});

test('a small or SVG image gets padding; preset null and src override the URL', () => {
	const svg = mountPreview({ file: { ...image, type: 'image/svg+xml', height: null }, preset: null });
	expect(svg.get('.image').classes()).toContain('p-14');
	expect(svg.get('img').attributes('src')).toBe('https://api.test/assets/img?v=2024-01-01T00%3A00%3A00Z');

	const small = mountPreview({ file: { ...image, height: 100 }, src: 'https://cdn.test/x.jpg' });
	expect(small.get('.image').classes()).toContain('p-14');
	expect(small.get('img').attributes('src')).toBe('https://cdn.test/x.jpg');
});

test('a failed image shows the error state', async () => {
	const wrapper = mountPreview({ file: image });
	await wrapper.get('img').trigger('error');

	expect(wrapper.find('img').exists()).toBe(false);
	expect(wrapper.text()).toContain('broken_image');
	expect(wrapper.text()).toContain('The image could not be loaded');
});

test('video and audio use native controls; other types show the extension', () => {
	expect(
		mountPreview({ file: { ...image, type: 'video/mp4' } })
			.get('video')
			.attributes('controls'),
	).toBeDefined();
	expect(
		mountPreview({ file: { ...image, type: 'audio/mpeg' } })
			.get('audio')
			.attributes('controls'),
	).toBeDefined();

	const pdf = mountPreview({ file: { ...image, type: 'application/pdf' } });
	expect(pdf.get('.fallback').text()).toContain('pdf');
	expect(
		mountPreview({ file: { ...image, type: null } })
			.get('.fallback')
			.text(),
	).toContain('unknown');
});

test('in a modal the whole preview emits click (not the media controls) and the height is 85vh', async () => {
	const wrapper = mountPreview({ file: image, inModal: true });

	expect(wrapper.find('button').exists()).toBe(false);
	expect(wrapper.get('img').attributes('style')).toContain('max-height: 85vh');
	await wrapper.get('img').trigger('click');
	expect(wrapper.emitted('click')).toHaveLength(1);

	const video = mountPreview({ file: { ...image, type: 'video/mp4' }, inModal: true });
	await video.get('video').trigger('click');
	expect(video.emitted('click')).toBeUndefined();
});

test('disabled disables the preview button', () => {
	expect(mountPreview({ file: image, disabled: true }).get('button').attributes('disabled')).toBeDefined();
});
