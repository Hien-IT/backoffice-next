// Ported from directus/app/src/interfaces/map/index.ts
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../types.ts';

export default defineInterface({
	id: 'map',
	name: '$t:interfaces.map.map',
	description: '$t:interfaces.map.description',
	icon: 'map',
	// Backoffice: async so MapLibre and Mapbox Draw stay in their own chunk (research R12).
	component: defineAsyncComponent(() => import('./InterfaceMap.vue')),
	types: [
		'geometry.Point',
		'geometry.LineString',
		'geometry.Polygon',
		'geometry.MultiPoint',
		'geometry.MultiLineString',
		'geometry.MultiPolygon',
		'geometry',
		'json',
		'string',
		'text',
		'csv',
	],
	group: 'selection',
	// Backoffice: Directus uses the options.vue component; the keys it writes are kept as data for 016 (D-56).
	options: [
		{
			field: 'geometryType',
			name: '$t:interfaces.map.geometry_type',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: {
					choices: ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].map((value) => ({
						text: value,
						value,
					})),
				},
			},
		},
		{
			field: 'defaultView',
			name: '$t:interfaces.map.default_view',
			type: 'json',
			meta: { width: 'full', interface: 'input-code', options: { language: 'JSON' } },
		},
	],
	recommendedDisplays: [],
});
