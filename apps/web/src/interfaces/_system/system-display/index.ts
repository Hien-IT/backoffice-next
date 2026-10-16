// Ported from directus/app/src/interfaces/_system/system-display/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemDisplay from './SystemDisplay.vue';

export default defineInterface({
	id: 'system-display',
	name: '$t:interfaces.system-display.display',
	description: '$t:interfaces.system-display.description',
	icon: 'box',
	component: InterfaceSystemDisplay,
	types: ['string'],
	system: true,
	options: [],
});
