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
	// Backoffice: the options component of Directus (D-56 lifted), async so it stays out of the main chunk.
	options: defineAsyncComponent(() => import('./InterfaceMapOptions.vue')) as never,
	recommendedDisplays: [],
});
