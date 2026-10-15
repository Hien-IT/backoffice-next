// Ported from directus/app/src/interfaces/_system/system-token/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemToken from './SystemToken.vue';

export default defineInterface({
	id: 'system-token',
	name: '$t:interfaces.system-token.system-token',
	description: '$t:interfaces.system-token.description',
	icon: 'vpn_key',
	component: InterfaceSystemToken,
	system: true,
	types: ['hash'],
	options: [],
});
