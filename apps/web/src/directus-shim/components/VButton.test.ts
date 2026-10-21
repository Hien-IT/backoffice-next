import { useGroupableParent } from '@directus/composables';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import VButton from './VButton.vue';

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
});
const global = { plugins: [router] };

describe('VButton', () => {
	test('button with the kind as variant, emits click, outer slots', async () => {
		const wrapper = mount(VButton, {
			props: { kind: 'danger' },
			slots: { default: 'Delete', 'prepend-outer': '<i class="pre" />', 'append-outer': '<i class="post" />' },
			global,
		});
		const button = wrapper.get('button');

		expect(button.text()).toBe('Delete');
		expect(button.attributes('type')).toBe('button');
		expect(button.classes()).toContain('bg-error-600');
		expect(wrapper.find('.pre').exists()).toBe(true);
		expect(wrapper.find('.post').exists()).toBe(true);

		await button.trigger('click');
		expect(wrapper.emitted('click')).toHaveLength(1);
	});

	test('secondary, outlined, icon square, rounded, sizes, align', () => {
		const wrapper = mount(VButton, {
			props: { secondary: true, icon: true, rounded: true, small: true, tooltip: 'Edit' },
			slots: { default: 'E' },
			global,
		});
		const button = wrapper.get('button');

		expect(button.classes()).toEqual(expect.arrayContaining(['ring-gray-300', 'size-8', 'rounded-full']));
		expect(button.attributes('aria-label')).toBe('Edit');

		const outlined = mount(VButton, { props: { outlined: true, align: 'left', tile: true }, global }).get('button');
		expect(outlined.classes()).toEqual(
			expect.arrayContaining(['bg-transparent', 'ring-brand-500', 'justify-start', 'rounded-none']),
		);
	});

	test('href renders a link with target and rel, to renders a RouterLink, disabled a button', async () => {
		const link = mount(VButton, { props: { href: 'https://example.org', download: 'a.txt' }, global }).get('a');
		expect(link.attributes()).toMatchObject({
			href: 'https://example.org',
			target: '_blank',
			rel: 'noopener noreferrer',
			download: 'a.txt',
		});

		await router.push('/content');
		const routerLink = mount(VButton, { props: { to: '/content', outlined: true }, global }).get('a');
		expect(routerLink.attributes('href')).toBe('/content');
		// The current route makes it active: an active outlined button draws filled.
		expect(routerLink.classes()).toContain('bg-brand-500');

		expect(
			mount(VButton, { props: { to: '/content', disabled: true }, global })
				.find('a')
				.exists(),
		).toBe(false);
	});

	test('loading: no click, the loading slot replaces the spinner', async () => {
		const wrapper = mount(VButton, {
			props: { loading: true },
			slots: { default: 'Save', loading: '<i class="wait" />' },
			global,
		});

		expect(wrapper.find('.wait').exists()).toBe(true);
		expect(wrapper.get('button').attributes('aria-busy')).toBe('true');
		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('click')).toBeUndefined();
	});

	test('item-group member: click toggles the group, default slot gets active and toggle', async () => {
		const selection = ref<(string | number)[]>([]);

		const Group = defineComponent({
			setup(_, { slots }) {
				useGroupableParent(
					{ selection, onSelectionChange: (value) => (selection.value = value as string[]) },
					{},
					'item-group',
				);
				return () => h('div', slots['default']?.());
			},
		});

		const wrapper = mount(
			defineComponent({
				render: () =>
					h(Group, null, () =>
						h(VButton, { value: 'a' }, { default: ({ active }: { active: boolean }) => (active ? 'on' : 'off') }),
					),
			}),
			{ global },
		);

		expect(wrapper.text()).toBe('off');
		await wrapper.get('button').trigger('click');
		expect(selection.value).toEqual(['a']);
		expect(wrapper.text()).toBe('on');
	});
});
