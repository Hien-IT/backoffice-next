// Ported from directus/app/src/interfaces/_system/system-language/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceSystemLanguage from './SystemLanguage.vue';

export default defineInterface({
	id: 'system-language',
	name: '$t:language',
	icon: 'translate',
	component: InterfaceSystemLanguage,
	system: true,
	types: ['string'],
	options: [],
});
