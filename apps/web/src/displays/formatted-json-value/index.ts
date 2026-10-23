// Ported from directus/app/src/displays/formatted-json-value/index.ts
import { toArray } from '@directus/utils';
import { render } from 'micromustache';
import { defineDisplay } from '../types.ts';
import DisplayJsonValue from './DisplayFormattedJsonValue.vue';

export default defineDisplay({
	id: 'formatted-json-value',
	name: '$t:displays.formatted-json-value.formatted-json-value',
	description: '$t:displays.formatted-json-value.description',
	types: ['json', 'geometry'],
	icon: 'settings_ethernet',
	component: DisplayJsonValue,
	handler: (value, options) => {
		return (
			toArray(value)
				// Backoffice: reproduces DR 11.17.4 (R-xx at close): render(template, view) is called with the value as
				// the template and the format as the view, the reverse of the component (research R4).
				.map((val) => (options['format'] ? render(val, options['format']) : val))
				.join(', ')
		);
	},
	options: [
		{
			field: 'format',
			name: '$t:display_template',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: '{{ field }}',
				},
			},
		},
	],
});
