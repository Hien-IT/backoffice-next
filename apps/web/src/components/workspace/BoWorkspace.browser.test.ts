// Spec 017 FR-021, FR-025 (T017): the workspace is sized from its furthest tile as the Directus v-workspace, and a tile
// moves by whole grid cells while dragged in edit mode, never below cell 1, emitting its position as it moves.
import { mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import BoWorkspace from './BoWorkspace.vue';
import BoWorkspaceTile, { type AppTile } from './BoWorkspaceTile.vue';

const tiles: AppTile[] = [
	{ id: '$trigger', x: 1, y: 1, width: 14, height: 14, draggable: false },
	{ id: 'a', x: 19, y: 1, width: 14, height: 14 },
];

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => wrapper?.unmount());

function mountWorkspace(editMode: boolean, extra: Record<string, unknown> = {}) {
	const Host = defineComponent({
		setup: () => () =>
			h(
				BoWorkspace,
				{ tiles, editMode, gridSize: 18 },
				{
					tile: ({ tile }: { tile: AppTile }) =>
						h(BoWorkspaceTile, { ...tile, editMode, name: tile.id, alwaysUpdatePosition: true, ...extra }),
				},
			),
	});

	wrapper = mount(Host, { global: { plugins: [i18n] }, attachTo: document.body });
	return wrapper;
}

const box = (el: Element) => el.getBoundingClientRect();

test('size: view mode ends at the furthest tile, edit mode adds 25 cells', async () => {
	const view = mountWorkspace(false);
	const workspace = view.find('[data-workspace]').element as HTMLElement;
	expect(workspace.style.inlineSize).toBe(`${(19 + 14 - 1) * 18}px`);
	expect(workspace.style.blockSize).toBe(`${(1 + 14 - 1) * 18}px`);
	view.unmount();

	const edit = mountWorkspace(true);
	const editing = edit.find('[data-workspace]').element as HTMLElement;
	expect(editing.style.inlineSize).toBe(`${(19 + 14 + 25) * 18}px`);
	expect(editing.style.blockSize).toBe(`${(1 + 14 + 25) * 18}px`);
});

test('a tile sits on its grid cell and exposes it in data-pos-x/y', () => {
	const view = mountWorkspace(false);
	const [trigger, a] = view.findAll('[data-tile-id]').map((w) => w.element);

	expect(a!.getAttribute('data-pos-x')).toBe('19');
	expect(Math.round(box(a!).left - box(trigger!).left)).toBe(18 * 18);
	expect(Math.round(box(a!).width)).toBe(14 * 18);
});

test('dragging moves by whole cells, clamps to cell 1 and emits the position; the trigger does not move', async () => {
	const edit = mountWorkspace(true);
	const tile = edit.findAllComponents(BoWorkspaceTile)[1]!;
	const el = tile.element as HTMLElement;
	const start = box(el);

	el.dispatchEvent(
		new PointerEvent('pointerdown', { button: 0, clientX: start.left + 5, clientY: start.top + 5, bubbles: true }),
	);
	window.dispatchEvent(
		new PointerEvent('pointermove', { clientX: start.left + 5 + 3 * 18 + 4, clientY: start.top + 5 + 2 * 18 }),
	);
	await new Promise((resolve) => setTimeout(resolve, 40));
	expect(el.getAttribute('data-pos-x')).toBe('22');
	expect(el.getAttribute('data-pos-y')).toBe('3');
	expect(el.textContent).toContain('(21:2)');

	window.dispatchEvent(
		new PointerEvent('pointermove', { clientX: start.left - 40 * 18, clientY: start.top - 40 * 18 }),
	);
	await new Promise((resolve) => setTimeout(resolve, 40));
	window.dispatchEvent(new PointerEvent('pointerup', {}));
	await tile.vm.$nextTick();

	expect(tile.emitted('update')!.at(-1)).toEqual([{ position_x: 1, position_y: 1 }]);
	expect(el.getAttribute('data-pos-x')).toBe('19'); // the parent stages the update; the prop is unchanged here

	const trigger = edit.findAllComponents(BoWorkspaceTile)[0]!;
	trigger.element.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 500 }));
	window.dispatchEvent(new PointerEvent('pointerup', {}));
	expect(trigger.emitted('update')).toBeUndefined();
});

test('edit mode: the edit button and the options menu are buttons; Copy To is disabled for an unsaved tile', async () => {
	const edit = mountWorkspace(true, { id: '_new' });
	const tile = edit.findAllComponents(BoWorkspaceTile)[1]!;

	await tile.find('button[aria-label="Edit"]').trigger('click');
	expect(tile.emitted('edit')).toHaveLength(1);

	await tile.find('button[aria-label^="Options for"]').trigger('click');
	const copy = [...document.querySelectorAll('[role="menuitem"]')].find((item) =>
		item.textContent?.includes('Copy To'),
	);
	expect(copy?.getAttribute('data-disabled')).not.toBeNull();
});

test('view mode: no edit controls, no drag', () => {
	const view = mountWorkspace(false);
	expect(view.find('button[aria-label="Edit"]').exists()).toBe(false);
});

// Spec 018 FR-022 (T042): zoom to fit scales the grid into the scroller's content box (its padding excluded) and follows
// the scroller size; the tile slot gets the grid size; without the prop the flows layout keeps its box.
test('zoomToFit: one scale from the scroller content box, updated when the scroller resizes', async () => {
	const width = ref(316);
	const gridSizes: number[] = [];

	wrapper = mount(
		defineComponent({
			setup: () => () =>
				h('div', { style: { width: `${width.value}px`, height: '600px', padding: '8px', boxSizing: 'border-box' } }, [
					h(
						BoWorkspace,
						{ tiles, editMode: false, gridSize: 18, zoomToFit: true },
						{
							tile: ({ tile, gridSize }: { tile: AppTile; gridSize: number }) => {
								gridSizes.push(gridSize);
								return h(BoWorkspaceTile, { ...tile, name: tile.id });
							},
						},
					),
				]),
		}),
		{ global: { plugins: [i18n] }, attachTo: document.body },
	);

	const workspace = () => document.querySelector<HTMLElement>('[data-workspace]')!;
	// Width (19 + 14 - 1) * 18 = 576 px into 300 px; the 252 px height fits, so the width decides.
	await expect.poll(() => Number(workspace().dataset['zoom'])).toBeCloseTo(300 / 576, 3);
	expect(workspace().style.transform).toMatch(/^scale\(/);
	expect(gridSizes.every((size) => size === 18)).toBe(true);

	width.value = 604;
	await expect.poll(() => Number(workspace().dataset['zoom'])).toBeCloseTo(588 / 576, 3);
});

test('without zoomToFit the outer box is display: contents and there is no data-zoom (flows unchanged)', () => {
	const view = mountWorkspace(true);
	const workspace = view.find('[data-workspace]').element as HTMLElement;
	expect(workspace.hasAttribute('data-zoom')).toBe(false);
	expect(workspace.parentElement!.classList.contains('contents')).toBe(true);
	expect(workspace.style.transform).toBe('');
});
