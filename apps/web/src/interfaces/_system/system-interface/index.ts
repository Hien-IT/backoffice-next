// Ported from directus/app/src/interfaces/_system/system-interface/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemInterface from './SystemInterface.vue';

export default defineInterface({
	id: 'system-interface',
	name: '$t:interfaces.system-interface.interface',
	description: '$t:interfaces.system-interface.description',
	icon: 'box',
	component: InterfaceSystemInterface,
	types: ['string'],
	system: true,
	options: [],
});
