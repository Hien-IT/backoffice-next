// Ported from directus/app/src/modules/activity/index.ts
// Backoffice (spec 018 FR-002): route components are lazy like the other modules; the item drawer is a floating child
// route rendered in the page's `detail` view. D-40 lifted. `/content/directus_activity(/:pk)` reaches these routes
// through `checkForSystem` of the content module (getItemRoute, FR-065).
import { defineModule } from './types.ts';

export default defineModule({
	id: 'activity',
	hidden: true,
	name: '$t:activity',
	icon: 'notifications',
	routes: [
		{
			name: 'activity-collection',
			path: '',
			component: () => import('./activity/routes/ActivityCollectionRoute.vue'),
			props: true,
			children: [
				{
					name: 'activity-item',
					path: ':primaryKey',
					meta: { isFloatingView: true },
					components: { detail: () => import('./activity/routes/ActivityItemRoute.vue') },
				},
			],
		},
	],
});
