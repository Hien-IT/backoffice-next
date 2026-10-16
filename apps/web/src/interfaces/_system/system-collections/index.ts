// Ported from directus/app/src/interfaces/_system/system-collections/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemCollections from './SystemCollections.vue';

export default defineInterface({
	id: 'system-collections',
	name: '$t:interfaces.system-collections.collections',
	description: '$t:interfaces.system-collections.description',
	icon: 'featured_play_list',
	component: InterfaceSystemCollections,
	types: ['json', 'csv'],
	options: [
		{
			field: 'includeSystem',
			name: '$t:system',
			type: 'boolean',
			meta: {
				width: 'half',
				interface: 'boolean',
				options: {
					label: '$t:interfaces.system-collections.include_system_collections',
				},
			},
			schema: {
				default_value: false,
			},
		},
	],
	system: true,
	recommendedDisplays: ['labels'],
});
