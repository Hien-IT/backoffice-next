import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import VImage from './VImage.vue';

afterEach(() => vi.unstubAllGlobals());

test('empty pixel until visible, then src; attributes go to the img', async () => {
	let callback: (entries: { isIntersecting: boolean }[], observer: { disconnect: () => void }) => void = () => {};
	const disconnect = vi.fn();

	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(cb: typeof callback) {
				callback = cb;
			}
			observe() {}
			disconnect = disconnect;
		},
	);

	const wrapper = mount(VImage, { props: { src: '/assets/a.png' }, attrs: { alt: 'A', class: 'photo' } });
	const img = wrapper.get('img');

	expect(img.attributes('src')).toMatch(/^data:image\/png/);
	expect(img.attributes('alt')).toBe('A');
	expect(img.classes()).toContain('photo');

	callback([{ isIntersecting: true }], { disconnect });
	await flushPromises();

	expect(img.attributes('src')).toBe('/assets/a.png');
	expect(disconnect).toHaveBeenCalled();
});
