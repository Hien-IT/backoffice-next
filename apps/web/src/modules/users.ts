// Ported from directus/app/src/modules/users/index.ts
// Backoffice: route components are lazy (bundle budget). `/users/me` (D-86, kept from feature 012) is a redirect to the
// current user's page, declared before `:primaryKey`; the user store is hydrated before any private route. Routes that
// match nothing show the module not-found page (ContentNotFound with `module: 'users'`, FR-054). preRegisterCheck as
// in feature 012.
import { useUserStore } from '../stores/user.ts';
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
			name: 'users-me',
			path: 'me',
			redirect: () => {
				const user = useUserStore().currentUser;
				// A share user has no id: the user directory, which its permissions refuse (012 no-access screen).
				return user && 'id' in user ? `/users/${user.id}` : '/users';
			},
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
