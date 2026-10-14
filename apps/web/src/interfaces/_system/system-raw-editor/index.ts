// Ported from directus/app/src/interfaces/_system/system-raw-editor/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceInputTranslatedString from './SystemRawEditor.vue';

export default defineInterface({
	id: 'system-raw-editor',
	name: '$t:interfaces.system-raw-editor.system-raw-editor',
	description: '$t:interfaces.system-raw-editor.description',
	icon: 'code',
	component: InterfaceInputTranslatedString,
	system: true,
	types: ['string', 'text'],
	group: 'standard',
	options: [
		{
			field: 'placeholder',
			name: '$t:placeholder',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				options: {
					placeholder: '$t:enter_a_placeholder',
				},
			},
		},
	],
});
