// Ported from directus/app/src/interfaces/_system/system-fields/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemFields from './SystemFields.vue';

export default defineInterface({
	id: 'system-fields',
	name: '$t:interfaces.fields.name',
	icon: 'search',
	component: InterfaceSystemFields,
	types: ['csv', 'json'],
	options: [],
	system: true,
});
