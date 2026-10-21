// Spec 020 (T114, data-model §7 rows 62, 63): VWorkspace renders VWorkspaceTile per tile without a `tile` slot and
// re-emits the tile events with the tile; VWorkspaceTile is resizable by default, colors its icon and shows its note.
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import VWorkspace from './VWorkspace.vue';
import VWorkspaceTile from './VWorkspaceTile.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };
const tiles = [
	{ id: 'a', x: 1, y: 1, width: 10, height: 8, name: 'Alpha' },
	{ id: 'b', x: 12, y: 1, width: 10, height: 8, name: 'Beta' },
];

test('default slot per tile with { tile, gridSize }; tile events come back with the tile', async () => {
	const wrapper = mount(VWorkspace, {
		props: { tiles, editMode: true },
		slots: {
			default: '<template #default="{ tile, gridSize }"><p class="body">{{ tile.id }}/{{ gridSize }}</p></template>',
		},
		global,
	});

	expect(wrapper.findAll('.body').map((p) => p.text())).toEqual(['a/18', 'b/18']);
	// Resizable by default: the 8 handles of each tile in edit mode.
	expect(wrapper.findAll('[data-resize]')).toHaveLength(16);

	const tile = wrapper.findAllComponents(VWorkspaceTile)[1]!;
	tile.vm.$emit('edit');
	tile.vm.$emit('delete');
	tile.vm.$emit('update', { width: 12 });

	expect(wrapper.emitted('edit')).toEqual([[tiles[1]]]);
	expect(wrapper.emitted('delete')).toEqual([['b']]);
	expect(wrapper.emitted('update')).toEqual([[{ edits: { width: 12 }, id: 'b' }]]);
});

test('a tile slot replaces the default tiles', () => {
	const wrapper = mount(VWorkspace, {
		props: { tiles },
		slots: { tile: '<template #tile="{ tile }"><i class="own">{{ tile.name }}</i></template>' },
		global,
	});

	expect(wrapper.findAll('.own').map((i) => i.text())).toEqual(['Alpha', 'Beta']);
	expect(wrapper.findAllComponents(VWorkspaceTile)).toHaveLength(0);
});

test('VWorkspaceTile: the icon takes the color, the note is a labelled info icon', () => {
	const wrapper = mount(VWorkspaceTile, {
		props: { ...tiles[0]!, icon: 'bolt', color: 'var(--color-success-500)', note: 'Daily totals' },
		global,
	});
	const icons = wrapper.findAll('.material-symbols-rounded');

	expect(icons[0]!.text()).toBe('bolt');
	expect(icons[0]!.attributes('style')).toContain('color: var(--color-success-500)');
	expect(wrapper.get('[aria-label="Daily totals"]').text()).toBe('info');
});
