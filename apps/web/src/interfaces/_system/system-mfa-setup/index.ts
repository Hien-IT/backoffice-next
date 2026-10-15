// Ported from directus/app/src/interfaces/_system/system-mfa-setup/index.ts
// Backoffice: the component is loaded on first use, so qrcode stays out of the main chunk (research R10).
import { defineAsyncComponent } from 'vue';
import { defineInterface } from '../../types.ts';

export default defineInterface({
	id: 'system-mfa-setup',
	name: 'mfa-setup',
	icon: 'box',
	component: defineAsyncComponent(() => import('./SystemMfaSetup.vue')),
	types: ['text'],
	options: [],
	system: true,
});
