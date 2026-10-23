// DR has no test for layouts/map/style.ts: the layer colors come from the theme tokens (recipe Q-6).
import { afterEach, expect, test } from 'vitest';
import { getMapStyle } from './style.ts';

afterEach(() => {
	document.body.removeAttribute('style');
});

test('layers keep the Directus ids, source and filters; colors are the theme tokens read from the page', () => {
	const tokens: Record<string, string> = {
		'--color-brand-500': 'rgb(1, 1, 1)',
		'--color-orange-500': 'rgb(2, 2, 2)',
		'--color-gray-900': 'rgb(3, 3, 3)',
		'--color-white': 'rgb(4, 4, 4)',
		'--color-brand-300': 'rgb(5, 5, 5)',
		'--color-orange-200': 'rgb(6, 6, 6)',
		'--color-error-300': 'rgb(7, 7, 7)',
	};

	for (const [name, value] of Object.entries(tokens)) document.body.style.setProperty(name, value);

	const layers = getMapStyle();
	const byId = Object.fromEntries(layers.map((layer) => [layer.id, layer])) as Record<string, any>;

	expect(layers.map((layer) => layer.id)).toEqual([
		'__directus_polygons_outline',
		'__directus_polygons',
		'__directus_lines',
		'__directus_points_shadow',
		'__directus_points',
		'__directus_clusters',
		'__directus_cluster_count',
	]);
	expect(layers.every((layer) => layer.source === '__directus')).toBe(true);

	const stateColor = [
		'case',
		['boolean', ['feature-state', 'selected'], false],
		'rgb(2, 2, 2)',
		['boolean', ['feature-state', 'hovered'], false],
		'rgb(2, 2, 2)',
		'rgb(1, 1, 1)',
	];

	expect(byId['__directus_points'].paint['circle-color']).toEqual(stateColor);
	expect(byId['__directus_polygons'].paint['fill-color']).toEqual(stateColor);
	expect(byId['__directus_lines'].paint['line-color']).toEqual(stateColor);
	expect(byId['__directus_points'].paint['circle-stroke-color']).toBe('rgb(4, 4, 4)');
	expect(byId['__directus_points_shadow'].paint['circle-color']).toBe('rgb(3, 3, 3)');
	expect(byId['__directus_clusters'].paint['circle-color']).toEqual([
		'step',
		['get', 'point_count'],
		'rgb(5, 5, 5)',
		100,
		'rgb(6, 6, 6)',
		750,
		'rgb(7, 7, 7)',
	]);
});
