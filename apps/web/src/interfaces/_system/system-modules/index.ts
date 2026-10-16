// Ported from directus/app/src/interfaces/_system/system-modules/index.ts
// Backoffice: loaded on first use; its module list imports the module registry (and the router), which must not join
// the eager interface registry.
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-modules',
	name: '$t:module_bar',
	icon: 'arrow_drop_down_circle',
	component: defineAsyncComponent(() => import('./SystemModules.vue')),
	types: ['json'],
	options: [],
	system: true,
});
