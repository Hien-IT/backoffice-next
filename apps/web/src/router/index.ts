// Ported from directus/app/src/router.ts (routes, router)
// Backoffice: history base /admin/ (the app is served there, FR-001); route screens are lazy chunks (research R12);
// screens of later phases (setup, password, invite, share) are RouteStub until they land; /register is the "not available yet" page (D-44).
import { createRouter, createWebHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router';
import { useServerStore } from '../stores/server.ts';
import { onAfterEach, onBeforeEach } from './guard.ts';

const RouteStub = (): Promise<RouteComponent> => import('../routes/RouteStub.vue');

export const defaultRoutes: RouteRecordRaw[] = [
	{
		path: '/',
		redirect: () => {
			const serverStore = useServerStore();

			if (serverStore.info.setupCompleted) {
				return '/login';
			} else {
				return '/setup';
			}
		},
	},
	{
		name: 'setup',
		path: '/setup',
		component: RouteStub,
		beforeEnter: async () => {
			const serverStore = useServerStore();

			if (serverStore.info.setupCompleted) {
				return '/login';
			}

			return;
		},
		meta: {
			public: true,
		},
	},
	{
		name: 'login',
		path: '/login',
		component: () => import('../routes/login/LoginRoute.vue'),
		props: (route) => ({
			ssoErrorCode: route.query['error'] ? route.query['code'] : null,
			logoutReason: route.query['reason'],
		}),
		meta: {
			public: true,
		},
	},
	{
		name: 'reset-password',
		path: '/reset-password',
		component: RouteStub,
		meta: {
			public: true,
		},
	},
	{
		name: 'register',
		path: '/register',
		component: RouteStub,
		meta: {
			public: true,
		},
	},
	{
		name: 'accept-invite',
		path: '/accept-invite',
		component: RouteStub,
		meta: {
			public: true,
		},
	},
	{
		name: 'tfa-setup',
		path: '/tfa-setup',
		component: () => import('../routes/TfaSetupRoute.vue'),
		meta: {
			track: false,
		},
	},
	{
		name: 'logout',
		path: '/logout',
		component: () => import('../routes/LogoutRoute.vue'),
		meta: {
			public: true,
		},
	},
	{
		name: 'shared',
		path: '/shared/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
		component: RouteStub,
		meta: {
			public: true,
		},
	},
	{
		name: 'private-404',
		path: '/:_(.+)+',
		component: () => import('../routes/PrivateNotFoundRoute.vue'),
	},
];

export const router = createRouter({
	history: createWebHistory('/admin/'),
	routes: defaultRoutes,
});

router.beforeEach(onBeforeEach);
router.afterEach(onAfterEach);
