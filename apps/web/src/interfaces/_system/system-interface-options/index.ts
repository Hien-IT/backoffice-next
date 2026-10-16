// Ported from directus/app/src/interfaces/_system/system-interface-options/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemInterfaceOptions from './SystemInterfaceOptions.vue';

export default defineInterface({
	id: 'system-interface-options',
	name: '$t:interfaces.system-interface-options.interface-options',
	description: '$t:interfaces.system-interface-options.description',
	icon: 'box',
	component: InterfaceSystemInterfaceOptions,
	types: ['string'],
	system: true,
	options: [],
});
