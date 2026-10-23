// Ported from directus/app/src/interfaces/list/index.ts
import { defineAsyncComponent } from 'vue';
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
	// Backoffice: the options component of DR (D-56 lifted), async so it stays out of the main chunk.
	options: defineAsyncComponent(() => import('./InterfaceListOptions.vue')) as never,
});
