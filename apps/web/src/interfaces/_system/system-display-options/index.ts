// Ported from directus/app/src/interfaces/_system/system-display-options/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemDisplayOptions from './SystemDisplayOptions.vue';

export default defineInterface({
	id: 'system-display-options',
	name: '$t:interfaces.system-display-options.display-options',
	description: '$t:interfaces.system-display-options.description',
	icon: 'box',
	component: InterfaceSystemDisplayOptions,
	types: ['string'],
	system: true,
	options: [],
});
