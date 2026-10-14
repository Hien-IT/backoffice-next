// Ported from directus/app/src/interfaces/list/index.ts
import { defineInterface } from '../types.ts';
import InterfaceList from './InterfaceList.vue';

export default defineInterface({
	id: 'list',
	name: '$t:interfaces.list.repeater',
	description: '$t:interfaces.list.description',
	icon: 'replay',
	component: InterfaceList,
	types: ['json'],
	group: 'selection',
	// Backoffice: Directus uses the options.vue component; the keys it writes are kept as data for 016 (D-56).
	options: [
		{
			field: 'template',
			name: '$t:template',
			type: 'string',
			meta: { width: 'half', interface: 'input', options: { placeholder: '{{ field }}' } },
		},
		{
			field: 'addLabel',
			name: '$t:interfaces.list.add_label',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'system-input-translated-string',
				options: { placeholder: '$t:create_new' },
			},
		},
		{
			field: 'sort',
			name: '$t:interfaces.list.sort',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-dropdown',
				options: { placeholder: '$t:interfaces.list.sort_placeholder' },
			},
		},
		{
			field: 'fields',
			name: '$t:interfaces.list.edit_fields',
			type: 'json',
			meta: { width: 'full', interface: 'list' },
		},
	],
});
