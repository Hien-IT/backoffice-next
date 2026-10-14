// Ported from directus/app/src/modules/users/index.ts
// Backoffice: id, name, icon and preRegisterCheck only; /users/me is the profile page of feature 012 (FR-024), the
// other routes are the module frame (D-40, feature 015).
import { canRead, defineModule, placeholderRoutes } from './types.ts';

export default defineModule({
	id: 'users',
	name: '$t:user_directory',
	icon: 'people_alt',
	routes: [
		{ name: 'users-me', path: 'me', component: () => import('../routes/ProfileRoute.vue'), meta: { module: 'users' } },
		...placeholderRoutes('users'),
	],
	preRegisterCheck: canRead('directus_users'),
});
