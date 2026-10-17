// Ported from directus/app/src/modules/insights/index.ts
// Backoffice (spec 018 FR-001): the dashboard page loads the panel data in `beforeEnter` like Directus; the panel drawer
// is a floating child route rendered in the page's `detail` view. D-40 lifted.
import type { RouteLocationNormalized } from 'vue-router';
import { useInsightsStore } from '../stores/insights.ts';
import { canRead, defineModule } from './types.ts';

export default defineModule({
	id: 'insights',
	name: '$t:insights',
	icon: 'insights',
	routes: [
		{
			name: 'insights-overview',
			path: '',
			component: () => import('./insights/routes/InsightsOverviewRoute.vue'),
		},
		{
			name: 'insights-dashboard',
			path: ':primaryKey',
			component: () => import('./insights/routes/DashboardRoute.vue'),
			props: true,
			beforeEnter(to: RouteLocationNormalized) {
				const insightsStore = useInsightsStore();
				insightsStore.refresh(to.params['primaryKey'] as string);
			},
			children: [
				{
					name: 'panel-detail',
					path: ':panelKey',
					props: true,
					meta: { isFloatingView: true },
					components: { detail: () => import('./insights/routes/PanelConfiguration.vue') },
				},
			],
		},
	],
	preRegisterCheck: canRead('directus_dashboards'),
});
