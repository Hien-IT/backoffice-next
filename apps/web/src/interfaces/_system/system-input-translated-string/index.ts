// Ported from directus/app/src/interfaces/_system/system-input-translated-string/index.ts
// Backoffice: no preview SVG (the interface picker of the data model comes with feature 016).
import { defineInterface } from '../../types.ts';
import InterfaceInputTranslatedString from './InputTranslatedString.vue';

export default defineInterface({
	id: 'system-input-translated-string',
	name: '$t:interfaces.input-translated-string.input-translated-string',
	description: '$t:interfaces.input-translated-string.description',
	icon: 'translate',
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
