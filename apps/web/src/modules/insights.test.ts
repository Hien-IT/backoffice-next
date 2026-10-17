// Feature 018 (FR-001, FR-003, data-model §1): the routes of directus/app/src/modules/insights/index.ts.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { useInsightsStore } from '../stores/insights.ts';
import insights from './insights.ts';

// router.push loads the lazy route components; their module graph can take over 5 s on a loaded CI runner.
vi.mock('./insights/routes/InsightsOverviewRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./insights/routes/DashboardRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./insights/routes/PanelConfiguration.vue', () => ({ default: { render: () => null } }));

function router() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/insights', children: insights.routes as RouteRecordRaw[], component: { render: () => null } }],
	});
}

async function resolve(path: string) {
	const r = router();
	await r.push(path);
	return r.currentRoute.value;
}

beforeEach(() => setActivePinia(createPinia()));

describe('insights module routes', () => {
	test('overview, dashboard (refresh in beforeEnter) and the floating panel drawer', async () => {
		const refresh = vi.spyOn(useInsightsStore(), 'refresh').mockResolvedValue();

		expect((await resolve('/insights')).name).toBe('insights-overview');

		const dashboard = await resolve('/insights/d1');
		expect(dashboard.name).toBe('insights-dashboard');
		expect(dashboard.params['primaryKey']).toBe('d1');
		expect(refresh).toHaveBeenCalledWith('d1');

		const drawer = await resolve('/insights/d1/+');
		expect(drawer.name).toBe('panel-detail');
		expect(drawer.params['panelKey']).toBe('+');
		expect(drawer.meta['isFloatingView']).toBe(true);
		expect(Object.keys(drawer.matched.at(-1)!.components!)).toEqual(['detail']);
	});

	test('module entry: id, icon, name and the read check of directus_dashboards', () => {
		expect(insights).toMatchObject({ id: 'insights', icon: 'insights', name: '$t:insights' });
		const check = insights.preRegisterCheck!;
		expect(
			check({ admin_access: false } as never, { directus_dashboards: { read: { access: 'full' } } } as never),
		).toBe(true);
		expect(check({ admin_access: false } as never, {} as never)).toBe(false);
		expect(check({ admin_access: true } as never, {} as never)).toBe(true);
	});
});
