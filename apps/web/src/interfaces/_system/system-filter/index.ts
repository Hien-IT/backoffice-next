// Ported from directus/app/src/interfaces/_system/system-filter/index.ts
// Backoffice: the component is loaded on first use (vuedraggable, the field tree and the value inputs stay out of the
// main chunk); SearchInput imports SystemFilter.vue directly, like DR search-input.
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-filter',
	name: '$t:interfaces.filter.name',
	icon: 'search',
	component: defineAsyncComponent(() => import('./SystemFilter.vue')),
	types: ['json'],
	options: [],
	system: true,
});
