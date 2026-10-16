// Ported from directus/app/src/interfaces/_system/system-scope/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemScope from './SystemScope.vue';

export default defineInterface({
	id: 'system-scope',
	name: '$t:scope',
	icon: 'arrow_drop_down_circle',
	component: InterfaceSystemScope,
	types: ['string'],
	options: [],
	system: true,
});
