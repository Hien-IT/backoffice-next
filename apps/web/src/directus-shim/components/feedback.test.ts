// Spec 020 (T114, data-model §7): the feedback shims bridge the DR props onto the Bo components.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import VBreadcrumb from './VBreadcrumb.vue';
import VError from './VError.vue';
import VInfo from './VInfo.vue';
import VNotice from './VNotice.vue';
import VPagination from './VPagination.vue';
import VProgressCircular from './VProgressCircular.vue';
import VProgressLinear from './VProgressLinear.vue';
import VSkeletonLoader from './VSkeletonLoader.vue';
import VTextOverflow from './VTextOverflow.vue';

enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));

const global = { plugins: [i18n] };
const icons = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.material-symbols-rounded').map((i) => i.text());

describe('VNotice', () => {
	test('icon null or true is the icon of the type, a string replaces it, false hides it', async () => {
		const wrapper = mount(VNotice, { props: { type: 'warning' }, slots: { default: 'Body' } });
		expect(icons(wrapper)).toEqual(['warning']);

		await wrapper.setProps({ icon: true });
		expect(icons(wrapper)).toEqual(['warning']);

		await wrapper.setProps({ icon: 'bolt' });
		expect(icons(wrapper)).toEqual(['bolt']);

		await wrapper.setProps({ icon: false });
		expect(icons(wrapper)).toEqual([]);
	});

	test('the title slot is the heading line above the text; center centers', () => {
		const wrapper = mount(VNotice, { props: { center: true }, slots: { title: 'Heads up', default: 'Body' } });

		expect(wrapper.get('p').text()).toBe('Heads up');
		expect(wrapper.text()).toContain('Body');
		expect(wrapper.classes()).toContain('justify-center');
	});
});

describe('VInfo', () => {
	test('no icon by default; center positions it in the middle; no empty paragraph without text', () => {
		const wrapper = mount(VInfo, { props: { title: 'Nothing', center: true } });

		expect(icons(wrapper)).toEqual([]);
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['absolute', 'top-1/2', 'start-1/2']));
		expect(wrapper.find('p').exists()).toBe(false);
	});
});

describe('VError', () => {
	test('code and message of an API error, of an SDK error and of a plain error', () => {
		const api = { response: { data: { errors: [{ message: 'No access', extensions: { code: 'FORBIDDEN' } }] } } };
		expect(
			mount(VError, { props: { error: api }, global })
				.get('output')
				.text(),
		).toBe('[FORBIDDEN] No access');

		const sdk = { errors: [{ message: 'Bad', extensions: { code: 'INVALID_PAYLOAD' } }] };
		expect(
			mount(VError, { props: { error: sdk }, global })
				.get('output')
				.text(),
		).toBe('[INVALID_PAYLOAD] Bad');

		const plain = new Error('x'.repeat(250));
		const text = mount(VError, { props: { error: plain }, global })
			.get('output')
			.text();
		expect(text).toBe(`[UNKNOWN] ${'x'.repeat(197)}...`);
	});
});

describe('VSkeletonLoader', () => {
	test.each([
		['input', 0],
		['list-item-icon', 2],
		['pagination', 3],
	] as const)('%s renders %i inner shapes and is hidden from assistive technology', (type, count) => {
		const wrapper = mount(VSkeletonLoader, { props: { type } });

		expect(wrapper.attributes('aria-hidden')).toBe('true');
		expect(wrapper.findAll(':scope > div')).toHaveLength(count);
	});
});

describe('VProgressCircular', () => {
	test('sizes as Directus, the slot in the middle, the value on the progressbar', () => {
		const wrapper = mount(VProgressCircular, { props: { large: true, value: 40 }, slots: { default: '40' }, global });

		expect((wrapper.element as HTMLElement).style.width).toBe('2.6875rem');
		expect(wrapper.get('[role="progressbar"]').attributes()).toMatchObject({
			'aria-valuenow': '40',
			'aria-label': 'Loading...',
		});
		expect(wrapper.text()).toBe('40');
	});

	test('re-emits animationiteration of the svg', async () => {
		const wrapper = mount(VProgressCircular, { props: { indeterminate: true }, global });
		await wrapper.get('svg').trigger('animationiteration');
		expect(wrapper.emitted('animationiteration')).toHaveLength(1);
	});
});

describe('VProgressLinear', () => {
	test.each([
		[20, 'bg-error-500'],
		[50, 'bg-warning-500'],
		[90, 'bg-success-500'],
	])('colorful at %i%% is %s; the slot gets the value', (value, color) => {
		const wrapper = mount(VProgressLinear, {
			props: { value, colorful: true },
			slots: { default: '<template #default="{ value }">{{ value }}%</template>' },
			global,
		});

		expect(wrapper.get('[role="progressbar"] > div').classes()).toContain(color);
		expect(wrapper.text()).toBe(`${value}%`);
	});

	test('absolute bottom positions the bar; rounded rounds it', () => {
		const wrapper = mount(VProgressLinear, { props: { absolute: true, bottom: true, rounded: true }, global });
		const style = (wrapper.element as HTMLElement).style;

		expect(style.position).toBe('absolute');
		expect(style.bottom).toBe('0px');
		expect(wrapper.classes()).toContain('rounded-full');
	});
});

describe('VPagination', () => {
	test('shown with one page, no page buttons without totalVisible, no first/last by default', () => {
		const wrapper = mount(VPagination, { props: { modelValue: 1, length: 1 }, global });

		expect(wrapper.find('nav').exists()).toBe(true);
		expect(wrapper.findAll('button').map((b) => b.attributes('aria-label'))).toEqual(['Previous', 'Next']);
	});

	test('totalVisible shows the page buttons; a click emits update:modelValue', async () => {
		const wrapper = mount(VPagination, { props: { modelValue: 1, length: 3, totalVisible: 5 }, global });
		const page2 = wrapper.findAll('button').find((b) => b.text() === '2')!;

		await page2.trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[2]]);
	});
});

describe('VBreadcrumb', () => {
	test('links for enabled sections, text for disabled ones, a chevron between', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });
		const wrapper = mount(VBreadcrumb, {
			props: {
				items: [
					{ name: 'Content', to: '/content', icon: 'folder' },
					{ name: 'Articles', to: '/x', disabled: true },
				],
			},
			global: { plugins: [router] },
		});
		await router.isReady();

		expect(wrapper.findAll('a').map((a) => [a.attributes('href'), a.text()])).toEqual([['/content', 'folder Content']]);
		expect(wrapper.text()).toContain('chevron_right');
		expect(wrapper.findAll('span > span').at(-1)!.text()).toBe('Articles');
	});
});

describe('VTextOverflow', () => {
	test('the text, or VHighlight with the query when `highlight`', () => {
		const VHighlight = defineComponent({
			props: { query: { type: String, default: '' }, text: { type: String, default: '' } },
			setup: (props) => () => h('mark', `${props.query}|${props.text}`),
		});

		expect(mount(VTextOverflow, { props: { text: 'Hello' } }).text()).toBe('Hello');

		const highlighted = mount(VTextOverflow, {
			props: { text: 'Hello', highlight: 'ell' },
			global: { components: { VHighlight } },
		});
		expect(highlighted.get('mark').text()).toBe('ell|Hello');
	});
});
