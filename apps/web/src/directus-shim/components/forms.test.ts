// Spec 020 (T114, data-model §7 rows 21, 74, 76): VForm, DrawerCollection and DrawerItem pass the DR props to the
// app components; the ignored props (VForm.collabContext, DrawerItem.overlay/popoverProps) are not passed on.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { defineComponent, h } from 'vue';
import DrawerCollection from './DrawerCollection.vue';
import DrawerItem from './DrawerItem.vue';
import VForm from './VForm.vue';

enableAutoUnmount(afterEach);

const stub = (name: string, slots: string[] = []) =>
	defineComponent({
		name,
		inheritAttrs: false,
		setup:
			(_, { attrs, slots: given }) =>
			() =>
				h(
					'div',
					{ 'data-props': JSON.stringify(attrs) },
					slots.map((slot) => given[slot]?.({ scoped: slot })),
				),
	});

const propsOf = (wrapper: ReturnType<typeof mount>) =>
	JSON.parse(wrapper.get('[data-props]').attributes('data-props')!);

test('VForm passes inline and the form props, not collabContext, and re-emits update:modelValue', async () => {
	const wrapper = mount(VForm, {
		props: { collection: 'articles', inline: true, collabContext: { registerField: () => null } },
		global: { stubs: { BoForm: stub('BoForm') } },
	});
	const props = propsOf(wrapper);

	expect(props).toMatchObject({ collection: 'articles', inline: true, showValidationErrors: true, version: null });
	expect(props).not.toHaveProperty('collabContext');

	wrapper.findComponent({ name: 'BoForm' }).vm.$emit('update:modelValue', { title: 'x' });
	expect(wrapper.emitted('update:modelValue')).toEqual([[{ title: 'x' }]]);
});

test('DrawerItem forces the drawer, leaves unset props to the app drawer, preventCancelWithEdits false as Directus', () => {
	const wrapper = mount(DrawerItem, {
		props: { collection: 'articles', primaryKey: 1, overlay: 'modal', popoverProps: { x: 1 }, version: 'draft' },
		slots: { actions: '<b class="act">A</b>' },
		global: { stubs: { AppDrawerItem: stub('AppDrawerItem', ['actions']) } },
	});
	const props = propsOf(wrapper);

	expect(props).toMatchObject({
		collection: 'articles',
		primaryKey: 1,
		version: 'draft',
		preventCancelWithEdits: false,
	});
	expect(props).not.toHaveProperty('overlay');
	expect(props).not.toHaveProperty('popoverProps');
	expect(props).not.toHaveProperty('applyShortcut');
	expect(wrapper.find('.act').exists()).toBe(true);
});

test('DrawerCollection passes every slot of the caller with its scope', () => {
	const wrapper = mount(DrawerCollection, {
		props: { collection: 'articles', active: true },
		slots: {
			sidebar: '<i class="side">S</i>',
			'title:append': '<template #title:append="{ scoped }"><i class="title">{{ scoped }}</i></template>',
		},
		global: { stubs: { AppDrawerCollection: stub('AppDrawerCollection', ['sidebar', 'title:append']) } },
	});

	expect(propsOf(wrapper)).toMatchObject({ collection: 'articles', active: true, selection: [] });
	expect(wrapper.get('.side').text()).toBe('S');
	expect(wrapper.get('.title').text()).toBe('title:append');
});
