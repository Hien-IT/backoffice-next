// Ported from directus/app/src/modules/settings/index.ts
// Backoffice: id, name, icon, the '' → data-model redirect and preRegisterCheck; the rest is the module frame
// (D-40, feature 016).
import { defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'settings',
	name: '$t:settings',
	icon: 'settings',
	routes: [
		{ name: 'settings-data-model-redirect', path: '', redirect: '/settings/data-model' },
		...placeholderRoutes('settings').slice(1),
	],
	preRegisterCheck: (user) => {
		return user.admin_access === true;
	},
});
