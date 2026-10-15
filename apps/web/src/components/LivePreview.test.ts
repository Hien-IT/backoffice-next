import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { i18n } from '../lang/index.ts';
import BoMenu from './BoMenu.vue';
import LivePreview from './LivePreview.vue';

const global = { plugins: [i18n] };
const URL_A = 'https://example.com/a';

function button(wrapper: ReturnType<typeof mount>, label: string) {
	return wrapper.get(`button[aria-label="${label}"]`);
}

test('iframe with exactly the Directus attributes (FR-069, T003 c)', () => {
	const wrapper = mount(LivePreview, { props: { url: URL_A }, global });
	const frame = wrapper.get('iframe');

	expect(frame.attributes()).toEqual({
		id: 'frame',
		src: URL_A,
		title: 'Live Website Preview',
		class: expect.any(String),
	});
	expect(wrapper.get('[data-url]').text()).toBe(URL_A);
});

test('no URL and invalid URL states', async () => {
	const wrapper = mount(LivePreview, { props: { url: [] }, global });

	expect(wrapper.find('iframe').exists()).toBe(false);
	expect(wrapper.get('h2').text()).toBe('No URL provided');
	expect(button(wrapper, 'Refresh Preview').attributes('disabled')).toBeDefined();

	await wrapper.setProps({ url: URL_A, invalidUrl: true });

	expect(wrapper.find('iframe').exists()).toBe(false);
	expect(wrapper.get('h2').text()).toBe('Invalid URL');
	expect(wrapper.get('[data-url]').text()).toBe('Select...');
	expect(wrapper.find('[data-dimensions]').exists()).toBe(false);
	expect(button(wrapper, 'Change Display Dimensions').attributes('disabled')).toBeDefined();
});

test('size toggle: full frame ↔ 400×600 with width/height inputs and zoom', async () => {
	const wrapper = mount(LivePreview, { props: { url: URL_A }, global });
	const toggle = button(wrapper, 'Change Display Dimensions');
	const handle = () => wrapper.get('iframe').element.parentElement as HTMLElement;

	expect(toggle.attributes('aria-pressed')).toBe('false');
	expect(wrapper.get('input[aria-label="Width"]').attributes('disabled')).toBeDefined();
	expect(button(wrapper, 'Zoom 100%').attributes('disabled')).toBeDefined();

	await toggle.trigger('click');

	expect(toggle.attributes('aria-pressed')).toBe('true');
	expect(handle().style.inlineSize).toBe('400px');
	expect(handle().style.blockSize).toBe('600px');

	await wrapper.get('input[aria-label="Width"]').setValue('320');
	await wrapper.get('input[aria-label="Height"]').setValue('480');
	expect(handle().style.inlineSize).toBe('320px');
	expect(handle().style.blockSize).toBe('480px');

	const zoomMenu = wrapper.findAllComponents(BoMenu).at(-1)!;
	expect(zoomMenu.props('items').map((item) => item.text)).toEqual(['25%', '50%', '75%', '100%', '150%', '200%']);
	zoomMenu.props('items')[5]!.onSelect!();
	await wrapper.vm.$nextTick();
	expect(handle().style.transform).toBe('scale(2)');
	expect(wrapper.find('button[aria-label="Zoom 200%"]').exists()).toBe(true);

	await toggle.trigger('click');

	expect(handle().style.inlineSize).toBe('100%');
	expect(handle().style.transform).toBe('scale(1)');
});

test('refresh and window.refreshLivePreview reload the iframe until it loads', async () => {
	const wrapper = mount(LivePreview, { props: { url: URL_A }, global });

	await button(wrapper, 'Refresh Preview').trigger('click');
	expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
	expect(button(wrapper, 'Refresh Preview').attributes('aria-busy')).toBe('true');

	await wrapper.get('iframe').trigger('load');
	expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);

	window.refreshLivePreview('https://example.com/b');
	await wrapper.vm.$nextTick();
	expect((wrapper.get('iframe').element as HTMLIFrameElement).src).toBe('https://example.com/b');
	expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
});

test('display options menu appends "open in new window"', () => {
	const wrapper = mount(LivePreview, {
		props: { url: URL_A, displayOptions: [{ text: 'Full Width', icon: 'width_full' }] },
		global,
	});
	const items = wrapper.findComponent(BoMenu).props('items');

	expect(wrapper.find('button[aria-label="Display Options"]').exists()).toBe(true);
	expect(items.map((item) => item.text)).toEqual(['Full Width', 'Open in New Window']);
	items[1]!.onSelect!();
	expect(wrapper.emitted('new-window')).toHaveLength(1);
});

test('full width shows "exit full width", the popup shows "open in split view"', async () => {
	const wrapper = mount(LivePreview, { props: { url: URL_A, isFullWidth: true, displayOptions: [] }, global });

	await button(wrapper, 'Exit Full Width').trigger('click');
	expect(wrapper.emitted('exit-full-width')).toHaveLength(1);

	await wrapper.setProps({ isFullWidth: false, inPopup: true });
	await button(wrapper, 'Open in Split View').trigger('click');
	expect(wrapper.emitted('new-window')).toHaveLength(1);
	expect(wrapper.find('button[aria-label="Display Options"]').exists()).toBe(false);
});

test('several URLs: menu to pick the frame URL', async () => {
	const URL_B = 'https://example.com/b';
	const wrapper = mount(LivePreview, { props: { url: [URL_A, URL_B] }, global });
	const items = wrapper.findComponent(BoMenu).props('items');

	expect(wrapper.get('button[data-url]').text()).toContain(URL_A);
	expect(items.map((item) => item.text)).toEqual([URL_A, URL_B]);

	items[1]!.onSelect!();
	await wrapper.vm.$nextTick();

	expect(wrapper.emitted('selectUrl')).toEqual([[URL_B, URL_A]]);
	expect(wrapper.get('iframe').attributes('src')).toBe(URL_B);
});
