// Ported from directus/app/src/interfaces/select-icon/index.ts
import { defineInterface } from '../types.ts';
import InterfaceSelectIcon from './SelectIcon.vue';

export default defineInterface({
	id: 'select-icon',
	name: '$t:interfaces.select-icon.icon',
	description: '$t:interfaces.select-icon.description',
	icon: 'insert_emoticon',
	component: InterfaceSelectIcon,
	types: ['string'],
	group: 'selection',
	options: [],
	recommendedDisplays: ['icon'],
});
