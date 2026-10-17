// Feature 018 (FR-002, FR-065, data-model §1): the routes of directus/app/src/modules/activity/index.ts and the
// `/content/directus_activity(/<id>)` redirect of the content module (checkForSystem).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import activity from './activity.ts';
import { checkForSystem } from './content.ts';

// router.push loads the lazy route components; their module graph can take over 5 s on a loaded CI runner.
vi.mock('./activity/routes/ActivityCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./activity/routes/ActivityItemRoute.vue', () => ({ default: { render: () => null } }));

function router() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/activity', children: activity.routes as RouteRecordRaw[], component: { render: () => null } },
			{
				path: '/content/:collection/:primaryKey?',
				component: { render: () => null },
				beforeEnter: checkForSystem,
			},
		],
	});
}

async function resolve(path: string) {
	const r = router();
	await r.push(path);
	return r.currentRoute.value;
}

beforeEach(() => setActivePinia(createPinia()));

describe('activity module routes', () => {
	test('the list and the floating item drawer', async () => {
		expect((await resolve('/activity')).name).toBe('activity-collection');

		const drawer = await resolve('/activity/12');
		expect(drawer.name).toBe('activity-item');
		expect(drawer.params['primaryKey']).toBe('12');
		expect(drawer.meta['isFloatingView']).toBe(true);
		expect(Object.keys(drawer.matched.at(-1)!.components!)).toEqual(['detail']);
		expect(drawer.matched[1]!.props['default']).toBe(true);
	});

	test('module entry: hidden, id, icon and name', () => {
		expect(activity).toMatchObject({ id: 'activity', hidden: true, icon: 'notifications', name: '$t:activity' });
		expect(activity.preRegisterCheck).toBeUndefined();
	});

	test('/content/directus_activity(/<id>) goes to /activity(/<id>) (FR-065)', async () => {
		expect((await resolve('/content/directus_activity')).name).toBe('activity-collection');
		expect((await resolve('/content/directus_activity/7')).fullPath).toBe('/activity/7');
	});
});
