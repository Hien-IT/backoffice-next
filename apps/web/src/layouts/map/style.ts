// Ported from directus/app/src/layouts/map/style.ts
import { cssVar } from '../../utils/css-var.ts';

// Backoffice: theme tokens instead of the Directus variables (recipe Q-6, like the 013 map interface style):
// `--theme--primary` = brand-500, `--theme--secondary` = orange-500, `--black` = gray-900, `--white` = white; the
// cluster steps use brand-300, orange-200 and error-300 instead of the raw hex colors (Constitution XII). The values
// are read once through getComputedStyle when the layout is set up, as Directus reads its variables.
export function getMapStyle() {
	const primary = cssVar('--color-brand-500');
	const secondary = cssVar('--color-orange-500');

	const color = [
		'case',
		['boolean', ['feature-state', 'selected'], false],
		secondary,
		['boolean', ['feature-state', 'hovered'], false],
		secondary,
		primary,
	];

	return [
		{
			id: '__directus_polygons_outline',
			type: 'line',
			source: '__directus',
			filter: ['all', ['!has', 'point_count'], ['==', '$type', 'Polygon']],
			paint: {
				'line-color': color,
				'line-width': 2,
			},
			layout: {
				'line-join': 'round',
			},
		},
		{
			id: '__directus_polygons',
			type: 'fill',
			source: '__directus',
			filter: ['all', ['!has', 'point_count'], ['==', '$type', 'Polygon']],
			paint: {
				'fill-color': color,
				'fill-opacity': 0.15,
			},
		},
		{
			id: '__directus_lines',
			type: 'line',
			source: '__directus',
			filter: ['all', ['!has', 'point_count'], ['==', '$type', 'LineString']],
			paint: {
				'line-color': color,
				'line-width': 2,
			},
		},
		{
			id: '__directus_points_shadow',
			type: 'circle',
			source: '__directus',
			filter: ['all', ['!has', 'point_count'], ['==', '$type', 'Point']],
			layout: {},
			paint: {
				'circle-radius': 10,
				'circle-blur': 1,
				'circle-opacity': 0.9,
				'circle-color': cssVar('--color-gray-900'),
			},
		},
		{
			id: '__directus_points',
			type: 'circle',
			source: '__directus',
			filter: ['all', ['!has', 'point_count'], ['==', '$type', 'Point']],
			layout: {},
			paint: {
				'circle-radius': 6,
				'circle-color': color,
				'circle-stroke-color': cssVar('--color-white'),
				'circle-stroke-width': 2,
			},
		},
		{
			id: '__directus_clusters',
			type: 'circle',
			source: '__directus',
			filter: ['has', 'point_count'],
			paint: {
				'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
				'circle-color': [
					'step',
					['get', 'point_count'],
					cssVar('--color-brand-300'),
					100,
					cssVar('--color-orange-200'),
					750,
					cssVar('--color-error-300'),
				],
				'circle-opacity': 0.7,
			},
		},
		{
			id: '__directus_cluster_count',
			type: 'symbol',
			source: '__directus',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': '{point_count_abbreviated}',
				'text-font': ['Open Sans Semibold'],
				'text-size': ['step', ['get', 'point_count'], 15, 100, 17, 750, 19],
			},
			paint: {
				'text-opacity': 0.85,
			},
		},
	];
}
