// Ported from directus/app/src/interfaces/_system/system-theme-overrides/index.ts
// Backoffice: the component is loaded on first use, so the Directus theme data stays out of the main chunk (R10).
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-theme-overrides',
	name: '$t:theme-overrides',
	icon: 'palette',
	component: defineAsyncComponent(() => import('./SystemThemeOverrides.vue')),
	types: ['json'],
	options: [],
	system: true,
});
