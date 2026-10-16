// Ported from directus/app/src/interfaces/_system/system-owner/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemOwner from './SystemOwner.vue';

export default defineInterface({
	id: 'system-owner',
	name: '$t:interfaces.system-owner.system-owner',
	description: '$t:interfaces.system-owner.description',
	icon: 'vpn_key',
	component: InterfaceSystemOwner,
	system: true,
	types: ['string'],
	options: [],
});
