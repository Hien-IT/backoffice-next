// DR has no test for utils/geometry/controls.ts: ButtonControl and BoxSelectControl against a fake MapLibre map
// (happy-dom has no WebGL; the real map runs in src/layouts/map/MapLayout.browser.test.ts).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BoxSelectControl, ButtonControl } from './controls.ts';

function fakeMap() {
	const container = document.createElement('div');
	document.body.appendChild(container);

	return {
		container,
		boxZoom: { enable: vi.fn(), disable: vi.fn() },
		dragPan: { enable: vi.fn(), disable: vi.fn() },
		getContainer: () => container,
		fire: vi.fn(),
		queryRenderedFeatures: vi.fn(() => [{ id: 1 }, { id: 2 }]),
	};
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('ButtonControl', () => {
	test('renders a button in a MapLibre control group and calls back on pointer down and click', () => {
		const callback = vi.fn();
		const control = new ButtonControl('ctrl-fit', callback);
		const group = control.onAdd();

		expect(group.className).toBe('maplibregl-ctrl maplibregl-ctrl-group');
		expect(group.firstChild).toBe(control.element);
		expect(control.element.className).toBe('ctrl-fit');

		control.element.dispatchEvent(new Event('pointerdown'));
		control.click('a');
		expect(callback).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenLastCalledWith('a');
	});

	test('activate and show toggle the active and hidden classes; onRemove detaches', () => {
		const control = new ButtonControl('ctrl', () => undefined);
		const group = control.onAdd();
		document.body.appendChild(group);

		control.activate(true);
		expect(control.active).toBe(true);
		expect(control.element.classList.contains('active')).toBe(true);
		control.activate(false);
		expect(control.element.classList.contains('active')).toBe(false);

		control.show(false);
		expect(control.element.classList.contains('hidden')).toBe(true);
		control.show(true);
		expect(control.element.classList.contains('hidden')).toBe(false);

		control.onRemove();
		expect(document.body.contains(group)).toBe(false);
	});
});

describe('BoxSelectControl', () => {
	test('onAdd disables box zoom and adds the selection box; Shift toggles select mode', () => {
		const map = fakeMap();
		const control = new BoxSelectControl({ boxElementClass: 'box', layers: ['a'] });

		expect(control.onAdd(map as any)).toBe(control.groupElement);
		expect(map.boxZoom.disable).toHaveBeenCalled();
		expect(map.container.querySelector('.box')).toBe(control.boxElement);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
		expect(control.active()).toBe(true);
		expect(control.selectButton.active).toBe(true);
		expect(map.fire).toHaveBeenLastCalledWith('select.enable');

		document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
		expect(control.active()).toBe(false);
		expect(map.fire).toHaveBeenLastCalledWith('select.disable');

		control.selectButton.click();
		expect(control.shiftPressed).toBe(true);
	});

	test('a drag in select mode draws the box and fires select.end with the features of the layers', () => {
		const map = fakeMap();
		const control = new BoxSelectControl({ layers: ['__directus_points'] });
		control.onAdd(map as any);
		control.activate(true);

		map.container.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 20 }));
		expect(map.dragPan.disable).toHaveBeenCalled();
		expect(map.fire).toHaveBeenLastCalledWith('select.start');

		document.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 5 }));
		expect(control.boxElement.style.transform).toBe('translate(10px, 5px)');
		expect(control.boxElement.style.inlineSize).toBe('30px');
		expect(control.boxElement.style.blockSize).toBe('15px');

		document.dispatchEvent(new MouseEvent('pointerup', { altKey: true }));
		const [box, options] = map.queryRenderedFeatures.mock.calls[0] as unknown as [any[], any];
		expect(box.map((p: { x: number; y: number }) => [p.x, p.y])).toEqual([
			[10, 20],
			[40, 5],
		]);
		expect(options).toEqual({ layers: ['__directus_points'] });
		expect(map.fire).toHaveBeenLastCalledWith('select.end', { features: [{ id: 1 }, { id: 2 }], alt: true });
		expect(map.dragPan.enable).toHaveBeenCalled();
		expect(control.boxElement.style.inlineSize).toBe('0');
	});

	test('no box without select mode; Escape clears the selection; onRemove removes the listeners', () => {
		const map = fakeMap();
		const control = new BoxSelectControl({ layers: [] });
		control.onAdd(map as any);

		map.container.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }));
		expect(control.selecting).toBe(false);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(map.fire).toHaveBeenCalledWith('select.end', { features: [] });
		expect(control.shiftPressed).toBe(false);

		control.onRemove();
		expect(map.boxZoom.enable).toHaveBeenCalled();
		map.fire.mockClear();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
		expect(map.fire).not.toHaveBeenCalled();
	});
});
