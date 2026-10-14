// Ported from directus/app/src/displays/collection/index.ts
import { useCollectionsStore } from '../../stores/collections.ts';
import { defineDisplay } from '../types.ts';
import DisplayCollection from './DisplayCollection.vue';

export default defineDisplay({
	id: 'collection',
	name: '$t:displays.collection.collection',
	description: '$t:displays.collection.description',
	types: ['string'],
	icon: 'label',
	component: DisplayCollection,
	handler: (value) => {
		const collectionsStore = useCollectionsStore();
		return collectionsStore.getCollection(value)?.name ?? value;
	},
	options: [
		{
			field: 'icon',
			name: '$t:icon',
			type: 'boolean',
			meta: {
				interface: 'boolean',
				options: {
					label: '$t:displays.collection.icon_label',
				},
			},
			schema: {
				default_value: false,
			},
		},
	],
});
