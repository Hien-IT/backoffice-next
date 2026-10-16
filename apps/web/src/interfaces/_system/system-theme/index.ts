// Ported from directus/app/src/interfaces/_system/system-theme/index.ts
// Backoffice: the component is loaded on first use, so the Directus theme data (theme-presets.json) and the preview
// stay out of the main chunk (research R10).
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-theme',
	name: '$t:theme',
	icon: 'palette',
	component: defineAsyncComponent(() => import('./SystemTheme.vue')),
	types: ['string'],
	options: [],
	system: true,
});
