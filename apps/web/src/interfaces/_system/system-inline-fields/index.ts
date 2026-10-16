// Ported from directus/app/src/interfaces/_system/system-inline-fields/index.ts
import { defineInterface } from '../../types.ts';
import InterfaceInlineFields from './SystemInlineFields.vue';

export default defineInterface({
	id: 'system-inline-fields',
	name: 'Inline Fields',
	description: 'Inline Fields',
	icon: 'box',
	component: InterfaceInlineFields,
	system: true,
	types: ['json'],
	group: 'standard',
	options: [],
});
