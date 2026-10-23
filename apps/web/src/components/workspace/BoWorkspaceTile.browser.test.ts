// Spec 018 FR-024, FR-025 (T060): the resize of v-workspace-tile.vue. The 8 handles exist only in edit mode on a
// resizable tile; a handle changes the size by whole cells, clamped to minWidth / minHeight and to cell 1; a top or
// left resize keeps moving the tile once the size is at its minimum (R-54, as DR); the W×H label shows while
// resizing; `update` carries the changed keys; the corners follow `borderRadius`. The flows tile (not resizable) is
// covered by BoWorkspace.browser.test.ts.
import { mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import { i18n } from '../../lang/index.ts';
import BoWorkspaceTile from './BoWorkspaceTile.vue';

const GRID = 20;

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => wrapper?.unmount());

function mountTile(props: Record<string, unknown> = {}) {
	wrapper = mount(BoWorkspaceTile, {
		props: {
			id: 'p1',
			x: 5,
			y: 5,
			width: 10,
			height: 8,
			name: 'Panel',
			gridSize: GRID,
			editMode: true,
			resizable: true,
			minWidth: 6,
			minHeight: 4,
			alwaysUpdatePosition: true,
			...props,
		},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	return wrapper;
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));

async function drag(handle: Element, dx: number, dy: number) {
	const start = handle.getBoundingClientRect();
	const x = start.left + start.width / 2;
	const y = start.top + start.height / 2;
	handle.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: x, clientY: y, bubbles: true }));
	window.dispatchEvent(new PointerEvent('pointermove', { clientX: x + dx, clientY: y + dy }));
	await frame();
}

const release = async () => {
	window.dispatchEvent(new PointerEvent('pointerup', {}));
	await frame();
};

test('8 handles only in edit mode on a resizable tile', async () => {
	const tile = mountTile();
	expect(tile.findAll('[data-resize]').map((h) => h.attributes('data-resize'))).toEqual([
		'top',
		'right',
		'bottom',
		'left',
		'top-left',
		'top-right',
		'bottom-right',
		'bottom-left',
	]);

	await tile.setProps({ editMode: false });
	expect(tile.findAll('[data-resize]')).toHaveLength(0);

	await tile.setProps({ editMode: true, resizable: false });
	expect(tile.findAll('[data-resize]')).toHaveLength(0);
});

test('bottom-right grows by whole cells and shows W×H; update has the size only', async () => {
	const tile = mountTile();
	const el = tile.element as HTMLElement;

	await drag(tile.find('[data-resize="bottom-right"]').element, 3 * GRID + 4, 2 * GRID - 3);
	expect(el.dataset).toMatchObject({ width: '13', height: '10', posX: '5', posY: '5' });
	expect(el.textContent).toContain('13×10');
	await release();

	expect(tile.emitted('update')!.at(-1)).toEqual([{ width: 13, height: 10 }]);
	expect(el.textContent).not.toContain('13×10');
});

test('right and bottom stop at minWidth / minHeight', async () => {
	const tile = mountTile();
	const el = tile.element as HTMLElement;

	await drag(tile.find('[data-resize="bottom-right"]').element, -20 * GRID, -20 * GRID);
	expect(el.dataset).toMatchObject({ width: '6', height: '4' });
	await release();
	expect(tile.emitted('update')!.at(-1)).toEqual([{ width: 6, height: 4 }]);
});

test('top-left at the minimum size keeps moving the tile, never above cell 1 (R-54)', async () => {
	const tile = mountTile();
	const el = tile.element as HTMLElement;

	await drag(tile.find('[data-resize="top-left"]').element, 6 * GRID, 6 * GRID);
	// Width 10 - 6 = 4 is clamped to 6 but x still moves by 6, as DR.
	expect(el.dataset).toMatchObject({ width: '6', height: '4', posX: '11', posY: '11' });
	await release();

	await drag(tile.find('[data-resize="top-left"]').element, -20 * GRID, -20 * GRID);
	expect(el.dataset).toMatchObject({ posX: '1', posY: '1', width: '30', height: '28' });
	await release();
});

test('the corners follow borderRadius and are all rounded while dragging', async () => {
	const tile = mountTile({ borderRadius: [true, false, false, true] });
	const el = tile.element as HTMLElement;
	expect(el.className).toMatch(/rounded-tl-xl.*rounded-tr-none.*rounded-br-none.*rounded-bl-xl/);

	await drag(tile.find('[data-resize="right"]').element, GRID, 0);
	expect(el.className).toContain('rounded-xl');
	await release();
});

// `unselectable` (Insights): in edit mode the tile cannot be selected and starts no native drag (webkit turned a pointer
// drag over a selection into a native one); out of edit mode, or without the prop (flows, as DR), the browser's.
test('unselectable in edit mode: no text selection, no native drag', async () => {
	const tile = mountTile({ unselectable: true });
	expect(tile.classes()).toContain('select-none');
	const dragstart = new Event('dragstart', { cancelable: true, bubbles: true });
	tile.element.dispatchEvent(dragstart);
	expect(dragstart.defaultPrevented).toBe(true);

	await tile.setProps({ editMode: false });
	expect(tile.classes()).not.toContain('select-none');
	const outside = new Event('dragstart', { cancelable: true, bubbles: true });
	tile.element.dispatchEvent(outside);
	expect(outside.defaultPrevented).toBe(false);

	await tile.setProps({ editMode: true, unselectable: false });
	expect(tile.classes()).not.toContain('select-none');
	const flows = new Event('dragstart', { cancelable: true, bubbles: true });
	tile.element.dispatchEvent(flows);
	expect(flows.defaultPrevented).toBe(false);
});
