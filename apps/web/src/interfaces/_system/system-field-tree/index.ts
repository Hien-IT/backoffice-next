// Ported from directus/app/src/interfaces/_system/system-field-tree/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemFieldTree from './SystemFieldTree.vue';

export default defineInterface({
	id: 'system-field-tree',
	name: '$t:field',
	icon: 'box',
	component: InterfaceSystemFieldTree,
	types: ['string'],
	options: [],
	system: true,
});
