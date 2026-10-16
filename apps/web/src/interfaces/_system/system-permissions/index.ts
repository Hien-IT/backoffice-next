// Ported from directus/app/src/interfaces/_system/system-permissions/index.ts
// Backoffice: the component is its own chunk (the matrix and its drawer load with the policy page only).
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-permissions',
	name: '$t:permissions',
	component: defineAsyncComponent(() => import('./SystemPermissions.vue')),
	icon: 'verified',
	types: ['alias'],
	localTypes: ['o2m'],
	relational: true,
	options: [],
	system: true,
});
