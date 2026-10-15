// Behaviour of directus/packages/composables/src/use-layout.test.ts on the Backoffice registry.
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { defineLayout } from './types.ts';
import { createLayoutWrapper, isWritableProp, useLayout } from './use-layout.ts';

const Empty = defineComponent({ render: () => null });

const tabular = defineLayout({
	id: 'tabular',
	name: 'Table',
	icon: 'table_rows',
	component: Empty,
	slots: { options: Empty, sidebar: Empty, actions: Empty },
	setup: (props) => ({ seenCollection: props.collection, local: 1 }),
});

const cards = defineLayout({
	id: 'cards',
	name: 'Cards',
	icon: 'grid_view',
	component: Empty,
	slots: { options: Empty, sidebar: Empty, actions: Empty },
	sidebarShadow: true,
	setup: (_props, { emit }) => ({ select: (keys: number[]) => emit('update:selection', keys) }),
});

test('isWritableProp knows selection, layoutOptions and layoutQuery', () => {
	expect(['selection', 'layoutOptions', 'layoutQuery', 'collection'].map(isWritableProp)).toEqual([true, true, true, false]);
});

test('useLayout picks the layout by id and falls back to tabular', () => {
	const id = ref<string | null>('cards');
	const { layoutWrapper } = useLayout(id, () => [cards, tabular]);

	expect((layoutWrapper.value as { name: string }).name).toBe('cards-wrapper');

	id.value = 'calendar';
	expect((layoutWrapper.value as { name: string }).name).toBe('tabular-wrapper');

	id.value = null;
	expect((layoutWrapper.value as { name: string }).name).toBe('tabular-wrapper');
});

test('the wrapper passes the setup state and the props to its slot and emits writable updates', async () => {
	let state: Record<string, any> = {};
	const wrapper = mount(createLayoutWrapper(cards), {
		props: { collection: 'articles', search: 'x' },
		slots: { default: (scope: { layoutState: Record<string, any> }) => ((state = scope.layoutState), h('div')) },
	});

	expect(state['collection']).toBe('articles');
	expect(state['search']).toBe('x');
	expect(state['showSelect']).toBe('multiple');
	expect(state['sidebarShadow']).toBe(true);

	state['select']([1, 2]);
	expect(wrapper.emitted('update:selection')).toEqual([[[1, 2]]]);

	state['onUpdate:layoutQuery']({ page: 2 });
	expect(wrapper.emitted('update:layoutQuery')).toEqual([[{ page: 2 }]]);
});

test('updates of keys that are not props are kept in the wrapper state', () => {
	let state: Record<string, any> = {};
	mount(createLayoutWrapper(tabular), {
		props: { collection: 'articles' },
		slots: { default: (scope: { layoutState: Record<string, any> }) => ((state = scope.layoutState), h('div')) },
	});

	expect(state['seenCollection']).toBe('articles');
	state['onUpdate:local'](5);
	expect(state['local']).toBe(5);

	state['onUpdate:collection']('other');
	expect(state['collection']).toBe('articles');
});
