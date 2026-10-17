// Spec 018 US3 (T062; FR-030 to FR-032): the panel drawer of routes/panel-configuration.vue. The grid lists the 11
// types; choosing one shows its options and the header group (on by default, its fields disabled once Show Header is
// off) and choosing another resets the options; Done on "+" stages a create at (1,1) with the type's minimum size, on
// an existing panel an update; an unknown panel key opens an empty drawer with Done disabled until a type is chosen;
// Cancel goes back to the dashboard.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type Router, type RouteRecordRaw } from 'vue-router';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useInsightsStore } from '../../../stores/insights.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useUserStore } from '../../../stores/user.ts';
import { mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import PanelConfiguration from './PanelConfiguration.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const t = (key: string) => i18n.global.t(key);
const SLOW = 15_000;
const DASHBOARD = 'dash-1';

const LABEL = {
	id: 'p-label',
	dashboard: DASHBOARD,
	type: 'label',
	name: 'Title',
	icon: 'title',
	color: null,
	note: null,
	show_header: true,
	position_x: 3,
	position_y: 4,
	width: 6,
	height: 2,
	options: { text: 'Hello' },
};

let router: Router;

async function setup(panelKey: string) {
	const routes: RouteRecordRaw[] = [
		{
			path: '/insights/:primaryKey',
			name: 'insights-dashboard',
			component: { render: () => h(RouterView, { name: 'detail' }) },
			children: [{ path: ':panelKey', name: 'panel-detail', props: true, components: { detail: PanelConfiguration } }],
		},
		{ path: '/:p(.*)*', component: { render: () => null } },
	];

	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/insights/${DASHBOARD}/${panelKey}`,
			async beforeMount() {
				mockFixtureApi(loadSnapshot(), {
					user: 'admin',
					answers: {
						'GET /dashboards': [{ id: DASHBOARD, name: 'Sales', icon: 'dashboard' }],
						'GET /panels': [LABEL],
						'POST /graphql': { data: {} },
					},
				});
				await useUserStore().hydrate();
				await Promise.all([useCollectionsStore().hydrate(), useFieldsStore().hydrate()]);
				await usePermissionsStore().hydrate();
				await useInsightsStore().hydrate();
			},
		},
	);

	router = mounted.router;
	await flushPromises();
	await flushPromises();
	return mounted;
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const types = () => [...dialog().querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
const typeCard = (name: string) => types().find((card) => card.textContent?.includes(name))!;
const done = () => dialog().querySelector<HTMLButtonElement>('[data-action="done"]')!;
const input = (label: string) =>
	[...dialog().querySelectorAll<HTMLInputElement>('input')].find((el) => el.labels?.[0]?.textContent?.trim() === label);

describe('PanelConfiguration', () => {
	test(
		'new panel: 11 types, options and header group, Done stages a create at (1,1) with the minimum size',
		async () => {
			await setup('+');
			const store = useInsightsStore();
			const create = vi.spyOn(store, 'stagePanelCreate');

			expect(types()).toHaveLength(11);
			expect(done().disabled).toBe(true);

			typeCard(t('panels.metric.name')).click();
			await flushPromises();
			expect(typeCard(t('panels.metric.name')).getAttribute('aria-pressed')).toBe('true');
			expect(done().disabled).toBe(false);
			expect(dialog().textContent).toContain(t('panel_header'));
			expect(input(t('name'))!.disabled).toBe(false);

			done().click();
			await flushPromises();

			expect(create).toHaveBeenCalledWith(
				expect.objectContaining({
					id: expect.stringMatching(/^_/),
					dashboard: DASHBOARD,
					type: 'metric',
					show_header: true,
					position_x: 1,
					position_y: 1,
					width: 6,
					height: 2,
					options: {},
				}),
			);
			expect(router.currentRoute.value.name).toBe('insights-dashboard');
		},
		SLOW,
	);

	test(
		'existing panel: opens with its values; Show Header off disables the header fields; Done stages an update',
		async () => {
			await setup(LABEL.id);
			const update = vi.spyOn(useInsightsStore(), 'stagePanelUpdate');

			expect(typeCard(t('panels.label.name')).getAttribute('aria-pressed')).toBe('true');
			expect(input(t('name'))!.value).toBe('Title');

			const showHeader = [...dialog().querySelectorAll<HTMLElement>('[role="checkbox"], input[type="checkbox"]')][0]!;
			showHeader.click();
			await flushPromises();
			expect(input(t('name'))!.disabled).toBe(true);

			done().click();
			await flushPromises();

			expect(update).toHaveBeenCalledWith({
				id: LABEL.id,
				edits: expect.objectContaining({ type: 'label', show_header: false, options: { text: 'Hello' } }),
			});
		},
		SLOW,
	);

	test(
		'choosing another type resets the options',
		async () => {
			await setup(LABEL.id);
			const update = vi.spyOn(useInsightsStore(), 'stagePanelUpdate');

			typeCard(t('panels.metric.name')).click();
			await flushPromises();
			done().click();
			await flushPromises();

			expect(update.mock.calls[0]![0].edits).toMatchObject({ type: 'metric', options: {} });
		},
		SLOW,
	);

	test(
		'an unknown panel key: no type chosen, Done disabled; Cancel goes back without staging',
		async () => {
			await setup('missing');
			const store = useInsightsStore();

			expect(types().every((card) => card.getAttribute('aria-pressed') === 'false')).toBe(true);
			expect(done().disabled).toBe(true);

			dialog()
				.querySelector<HTMLButtonElement>(`button[aria-label="${t('cancel')}"]`)!
				.click();
			await flushPromises();

			expect(store.hasEdits).toBe(false);
			expect(router.currentRoute.value.name).toBe('insights-dashboard');
		},
		SLOW,
	);
});
