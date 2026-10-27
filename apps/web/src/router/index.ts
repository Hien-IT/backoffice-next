// Ported from directus/app/src/router.ts (routes, router)
// Backoffice: history base /admin/ (the app is served there, FR-001); route screens are lazy chunks (research R12);
// /register is the "not available yet" page (D-44).
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useServerStore } from '../stores/server.ts';
import { onAfterEach, onBeforeEach } from './guard.ts';

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
		component: () => import('../routes/SetupRoute.vue'),
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
		component: () => import('../routes/reset-password/ResetPasswordRoute.vue'),
		meta: {
			public: true,
		},
	},
	{
		name: 'register',
		path: '/register',
		component: () => import('../routes/RegisterNotAvailableRoute.vue'),
		meta: {
			public: true,
		},
	},
	{
		name: 'accept-invite',
		path: '/accept-invite',
		component: () => import('../routes/AcceptInviteRoute.vue'),
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
	// Backoffice (spec 025, FR-029, D-189.4): no /shared/:id page; such a link falls to the not found route.
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
