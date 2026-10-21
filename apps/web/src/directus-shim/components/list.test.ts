import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import VList from './VList.vue';
import VListGroup from './VListGroup.vue';
import VListItem from './VListItem.vue';
import VListItemContent from './VListItemContent.vue';
import VListItemHint from './VListItemHint.vue';
import VListItemIcon from './VListItemIcon.vue';

const global = { plugins: [i18n] };

describe('VListItem', () => {
	test('element like Directus: button when clickable, a with href, li otherwise; links and buttons get an li in a list', () => {
		const wrapper = mount(VList, {
			slots: {
				default: () => [
					h(VListItem, { clickable: true }, () => 'Button'),
					h(VListItem, { href: 'https://example.com' }, () => 'Link'),
					h(VListItem, null, () => 'Plain'),
				],
			},
		});
		const items = wrapper.findAll('.v-list-item');

		expect(items.map((item) => item.element.tagName)).toEqual(['BUTTON', 'A', 'LI']);
		expect(items[1]!.attributes()).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' });
		expect(wrapper.findAll('ul > li').length).toBe(3);
		expect(mount(VListItem, { slots: { default: 'Alone' } }).element.tagName).toBe('DIV');
	});

	test('click is emitted unless disabled; attrs and the active state go to the item', async () => {
		const wrapper = mount(VListItem, { props: { clickable: true }, attrs: { class: 'mine', 'data-x': '1' } });
		await wrapper.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);
		expect(wrapper.classes()).toContain('mine');
		expect(wrapper.attributes('data-x')).toBe('1');

		await wrapper.setProps({ disabled: true, active: true });
		await wrapper.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);
		expect(wrapper.attributes('disabled')).toBeDefined();
		expect(wrapper.classes()).toContain('active');
	});

	const Empty = { render: () => null };

	test('to renders a RouterLink, active when the route matches (exact, query)', async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/content', component: Empty, children: [{ path: ':collection', component: Empty }] }],
		});
		await router.push('/content/articles?bookmark=1');

		const item = (props: Record<string, unknown>) =>
			mount(VListItem, { props, slots: { default: 'Articles' }, global: { plugins: [router] } });

		expect(item({ to: '/content' }).element.tagName).toBe('A');
		expect(item({ to: '/content' }).classes()).toContain('active');
		expect(item({ to: '/content', exact: true }).classes()).not.toContain('active');
		expect(item({ to: '/content/articles?bookmark=2', query: true }).classes()).not.toContain('active');
		expect(item({ to: '/content/articles?bookmark=1', query: true }).classes()).toContain('active');
		expect(item({ to: '/content', active: false }).classes()).not.toContain('active');
	});
});

describe('VList and VListGroup', () => {
	const tree = (props: Record<string, unknown> = {}, groupProps: Record<string, unknown> = {}) =>
		mount(VList, {
			props,
			global,
			slots: {
				default: () =>
					h(
						VListGroup,
						{ value: 'fruit', ...groupProps },
						{
							activator: ({ active }: { active: boolean }) => h(VListItemContent, () => `Fruit ${active}`),
							default: () => h(VListItem, null, () => 'Apple'),
						},
					),
			},
		});

	test('the arrow button toggles the group through the v-list selection (v-model)', async () => {
		const wrapper = tree({ modelValue: [], mandatory: false });
		const arrow = wrapper.get('button[aria-expanded]');

		expect(arrow.attributes('aria-label')).toBe('Toggle');
		expect(arrow.attributes('aria-expanded')).toBe('false');
		expect(wrapper.text()).toContain('Fruit false');
		expect(wrapper.find('ul.items').exists()).toBe(false);

		await arrow.trigger('click');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['fruit']]);
		expect(wrapper.emitted('toggle')).toHaveLength(1);

		await wrapper.setProps({ modelValue: ['fruit'] });
		expect(arrow.attributes('aria-expanded')).toBe('true');
		expect(wrapper.text()).toContain('Fruit true');
		expect(wrapper.get('ul.items > li').text()).toBe('Apple');
	});

	test('a click on the row toggles; clickable emits click instead; open forces it open', async () => {
		const wrapper = tree({ mandatory: false });
		await wrapper.get('.activator > div').trigger('click');
		expect(wrapper.find('ul.items').exists()).toBe(true);

		const clickable = tree({ mandatory: false }, { clickable: true });
		await clickable.get('.activator button:not([aria-label])').trigger('click');
		expect(clickable.findComponent(VListGroup).emitted('click')).toHaveLength(1);
		expect(clickable.find('ul.items').exists()).toBe(false);

		expect(tree({ mandatory: false }, { open: true }).find('ul.items').exists()).toBe(true);
	});

	test('arrowPlacement before / false, disabled', () => {
		expect(
			tree({}, { arrowPlacement: 'before' }).get('.activator').element.firstElementChild!.getAttribute('aria-label'),
		).toBe('Toggle');

		// Without an arrow the row itself is the toggle button.
		const noArrow = tree({ mandatory: false }, { arrowPlacement: false });
		expect(noArrow.findAll('.activator button')).toHaveLength(1);
		expect(noArrow.get('.activator button').attributes('aria-expanded')).toBe('false');

		const disabled = tree({}, { disabled: true });
		expect(disabled.get('button[aria-expanded]').attributes('disabled')).toBeDefined();
	});
});

test('VListItemHint and VListItemIcon take center; VListItemContent wraps the slot', () => {
	expect(mount(VListItemHint, { props: { center: true }, slots: { default: 'Hint' } }).classes()).toContain('center');
	expect(mount(VListItemIcon, { slots: { default: 'Icon' } }).classes()).not.toContain('center');
	expect(mount(VListItemContent, { slots: { default: '<span>Text</span>' } }).html()).toContain('<span>Text</span>');
});
