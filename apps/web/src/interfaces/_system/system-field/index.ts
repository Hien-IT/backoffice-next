// Ported from directus/app/src/interfaces/_system/system-field/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemField from './SystemField.vue';

export default defineInterface({
	id: 'system-field',
	name: '$t:field',
	icon: 'box',
	component: InterfaceSystemField,
	types: ['string'],
	options: [],
	system: true,
});
