// Spec 017 US4 (T070, T071; FR-050 to FR-055): the Logs section of the flow page and its drawer, on the three runs of
// bo_all_ops of the fixture set (two resolve, one reject through throw-error). The count is read when the page mounts,
// the list when the section opens (GET /revisions filtered on the flow and the `run` action, 10 per page); the day
// groups; the icon of a run follows its last step; "Show Failed Only" keeps the rejects of the page; a row opens the
// drawer with the trigger step (options, payload, accountability) and one entry per step (name, type, status).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw, useRoute } from 'vue-router';
import { replaceQueue } from '../../../../../api/sdk.ts';
import { resetNotices } from '../../../../../composables/use-notices.ts';
import { i18n } from '../../../../../lang/index.ts';
import { useSidebarStore } from '../../../../../layout/stores/sidebar.ts';
import { useFlowsStore } from '../../../../../stores/flows.ts';
import { usePermissionsStore } from '../../../../../stores/permissions.ts';
import { useServerStore } from '../../../../../stores/server.ts';
import { useUserStore } from '../../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../../../test-utils/layout.ts';
import LogsSidebarDetail from './LogsSidebarDetail.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

// The section alone (the detail panel of the page is a closed drawer below xl): rendered with the stored flow.
const routes: RouteRecordRaw[] = [
	{
		path: '/settings/flows/:primaryKey',
		component: defineComponent({
			setup() {
				const route = useRoute();
				return () =>
					h(LogsSidebarDetail, { flow: useFlowsStore().flows.find((flow) => flow.id === route.params['primaryKey'])! });
			},
		}),
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(name = 'bo_all_ops', { open = true } = {}) {
	const snapshot = loadSnapshot();
	const id = snapshot.editorFlows.find((flow) => flow.name === name)!.id;
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/settings/flows/${id}`,
			async beforeMount() {
				fetch = mockFixtureApi(snapshot, { user: 'admin' });
				await useUserStore().hydrate();
				await usePermissionsStore().hydrate();
				await useFlowsStore().hydrate();
				useServerStore().info.queryLimit = { default: 100, max: -1 };
				if (open) useSidebarStore().activeAccordionItem = 'logs';
				fetch.mockClear();
			},
		},
	);

	await flushPromises();
	return { ...mounted, id };
}

const runs = () => [...document.querySelectorAll<HTMLButtonElement>('[data-flow-log] button')];

test('the count on mount, the runs grouped by day with their status, newest first', async () => {
	const { id } = await setup();

	const revisionCalls = calls(fetch).filter((call) => call.startsWith('GET /revisions'));
	expect(revisionCalls.some((call) => call.includes('aggregate') && call.includes(id) && call.includes('"run"'))).toBe(
		true,
	);
	expect(revisionCalls.some((call) => call.includes('sort=-id') && call.includes('limit=10'))).toBe(true);
	expect(document.body.textContent).toContain(t('logs'));
	expect(runs().map((run) => run.dataset['status'])).toEqual(['reject', 'resolve', 'resolve']);
});

test('the list loads when the section opens; nothing before', async () => {
	await setup('bo_all_ops', { open: false });
	expect(calls(fetch).filter((call) => call.startsWith('GET /revisions') && !call.includes('aggregate'))).toEqual([]);
});

test('"Show Failed Only" keeps the reject of the page', async () => {
	await setup();
	const toggle = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(b) => !!b.textContent?.includes(t('show_failed_only')),
	)!;
	expect(toggle.getAttribute('aria-pressed')).toBe('false');
	toggle.click();
	await flushPromises();
	await flushPromises();
	expect(toggle.getAttribute('aria-pressed')).toBe('true');
	expect(runs().map((run) => run.dataset['status'])).toEqual(['reject']);
});

test('a run opens the drawer: the trigger step, then each step with its name, type and status', async () => {
	await setup();
	runs()[0]!.click();
	await flushPromises();

	const drawer = document.querySelector('[data-flow-log-steps]')!;
	expect(drawer.textContent).toContain(t('trigger'));
	expect(drawer.textContent).toContain(t('triggers.manual.name'));
	const steps = [...drawer.querySelectorAll<HTMLElement>('[data-step]')].map((step) => [
		step.dataset['step'],
		step.dataset['status'],
	]);
	expect(steps).toEqual([
		['condition', 'reject'],
		['throw_error', 'reject'],
	]);
	expect(drawer.textContent).toContain(t('operations.throw-error.name'));
});

test('a flow without runs: "no logs"', async () => {
	await setup('bo_webhook');
	expect(document.body.textContent).toContain(t('no_logs'));
});
