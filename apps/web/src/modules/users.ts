// Ported from directus/app/src/modules/users/index.ts
// Backoffice: route components are lazy (bundle budget). No `/users/me` route, as Directus (D-86, owner 2026-10-16):
// `me` is a `:primaryKey`. Routes that match nothing show the module not-found page (ContentNotFound with `module: 'users'`, FR-054). preRegisterCheck as
// in feature 012.
import { canRead, defineModule } from './types.ts';

const Collection = () => import('./users/routes/UsersCollectionRoute.vue');
const Item = () => import('./users/routes/UserItemRoute.vue');

export default defineModule({
	id: 'users',
	name: '$t:user_directory',
	icon: 'people_alt',
	routes: [
		{
			name: 'users-active',
			path: '',
			component: Collection,
			props: () => ({ status: 'active' }),
		},
		{
			name: 'users-suspended',
			path: 'suspended',
			component: Collection,
			props: () => ({ status: 'suspended' }),
		},
		{
			name: 'users-invited',
			path: 'invited',
			component: Collection,
			props: () => ({ status: 'invited' }),
		},
		{
			name: 'users-all',
			path: 'all',
			component: Collection,
			props: () => ({}),
		},
		{
			name: 'users-item',
			path: ':primaryKey',
			component: Item,
			props: true,
		},
		{
			path: 'roles',
			redirect: '/users',
		},
		{
			name: 'roles-collection',
			path: 'roles/:role',
			component: Collection,
			props: true,
		},
		{
			name: 'roles-item-add',
			path: 'roles/:role/+',
			component: Item,
			props: (route) => ({
				primaryKey: '+',
				role: route.params['role'],
			}),
		},
		{
			name: 'users-not-found',
			path: ':_(.+)+',
			component: () => import('./content/routes/ContentNotFound.vue'),
			props: { module: 'users' },
		},
	],
	preRegisterCheck: canRead('directus_users'),
});
