// Test helper (spec 020 T175): the named routes the marketplace pages link to, with stand-in components.
import type { RouteRecordRaw } from 'vue-router';

const stub = { render: () => null };

export const MARKETPLACE_TEST_ROUTES: RouteRecordRaw[] = [
	{
		path: '/settings/marketplace',
		children: [
			{ name: 'marketplace-registry', path: '', component: stub },
			{ name: 'marketplace-account', path: 'account/:accountId', component: stub },
			{ name: 'marketplace-extension', path: 'extension/:extensionId', component: stub },
		],
	},
	{ name: 'settings-extensions', path: '/settings/extensions', component: stub },
	{ path: '/:p(.*)*', component: stub },
];
