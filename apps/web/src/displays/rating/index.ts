// Ported from directus/app/src/displays/rating/index.ts
import { defineDisplay } from '../types.ts';
import DisplayRating from './DisplayRating.vue';

export default defineDisplay({
	id: 'rating',
	name: '$t:displays.rating.rating',
	description: '$t:displays.rating.description',
	icon: 'star',
	component: DisplayRating,
	options: [
		{
			field: 'simple',
			name: '$t:displays.rating.simple',
			type: 'boolean',
			meta: {
				interface: 'boolean',
				width: 'half',
				options: {
					label: '$t:displays.rating.simple_label',
				},
			},
			schema: {
				default_value: false,
			},
		},
	],
	types: ['integer', 'decimal', 'float'],
});
