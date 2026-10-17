// Spec 017 US1 (T030, T031; FR-010 to FR-016): the flows overview reads the flows store (no request when it opens), sorts
// by name by default and by the clicked column, opens a flow on row click, toggles the status and deletes from the row
// menu (PATCH / DELETE then GET /flows; an error leaves the store as it was), and the flow drawer creates a flow in two
// tabs (defaults of flow-drawer.vue, trigger tab locked without a name, trigger options reset, POST /flows with every
// value) or edits one (PATCH /flows/<id>, the drawer closes, no navigation). The fixture set has the 017 flows
// (bo_all_ops, bo_child, bo_event, bo_orphan, bo_schedule, bo_webhook) besides the 013/014 manual ones.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoFancySelect from '../../../../components/BoFancySelect.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { i18n } from '../../../../lang/index.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../../test-utils/layout.ts';
import FlowDrawer from './FlowDrawer.vue';
import FlowsOverviewRoute from './FlowsOverviewRoute.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
const SLOW = 15_000;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{ path: '/settings/flows', name: 'settings-flows-collection', component: FlowsOverviewRoute },
	{ path: '/settings/flows/:primaryKey', name: 'settings-flows-item', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(answers: Record<string, unknown> = {}, { hydrated = true } = {}) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: '/settings/flows',
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { user: 'admin', answers });
				await useUserStore().hydrate();
				await usePermissionsStore().hydrate();
				if (hydrated) await useFlowsStore().hydrate();
				fetch.mockClear();
			},
		},
	);

	await flushPromises();
	return mounted;
}

const rowNames = () =>
	[...document.querySelectorAll('main tbody tr')].map((r) => r.querySelectorAll('td')[2]?.textContent?.trim());
const rowStatus = (name: string) =>
	[...document.querySelectorAll('main tbody tr')]
		.find((r) => r.textContent?.includes(name))!
		.querySelectorAll('td')[1]!
		.textContent!.trim();
const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.getAttribute('aria-label') === label);
const bodies = (method: string, path: RegExp) =>
	fetch.mock.calls
		.filter(([input, init]) => (init?.method ?? 'GET') === method && path.test(new URL(String(input)).pathname))
		.map(([, init]) => JSON.parse(String(init!.body ?? 'null')));

async function openRowMenu(name: string) {
	const trigger = button(t('item_options', { item: name }))!;
	trigger.focus();
	await press(trigger, 'Enter');
}

async function chooseMenu(text: string) {
	const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
		el.textContent?.includes(text),
	)!;
	item.click();
	await flushPromises();
	await flushPromises();
}

describe('FlowsOverviewRoute', () => {
	test(
		'reads the store (no request), sorts by name, the status badge, a row opens its flow page',
		async () => {
			const { router } = await setup();

			expect(calls(fetch)).toEqual([]);
			expect(document.querySelector('main h1')!.textContent).toContain(t('flows'));
			const names = rowNames();
			expect(names).toEqual([...names].sort((a, b) => (a! < b! ? -1 : 1)));
			expect(names).toContain('bo_all_ops');
			expect(rowStatus('bo_schedule')).toBe(t('inactive'));
			expect(rowStatus('bo_all_ops')).toBe(t('active'));

			const row = [...document.querySelectorAll<HTMLElement>('main tbody tr')].find((r) =>
				r.textContent?.includes('bo_webhook'),
			)!;
			row.click();
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('settings-flows-item');
		},
		SLOW,
	);

	test(
		'clicking the Status header sorts by status; clearing the sort goes back to the name',
		async () => {
			await setup();
			const status = [...document.querySelectorAll<HTMLElement>('main thead th')].find((th) =>
				th.textContent?.includes(t('status')),
			)!;
			(status.querySelector('button') ?? status).click();
			await flushPromises();
			expect(rowNames().indexOf('bo_schedule')).toBe(rowNames().length - 1);
		},
		SLOW,
	);

	test(
		'row menu: set inactive sends PATCH {status} then GET /flows; an error keeps the badge',
		async () => {
			await setup();
			await openRowMenu('bo_webhook');
			await chooseMenu(t('set_flow_inactive'));

			expect(bodies('PATCH', /^\/flows\/[^/]+$/)).toEqual([{ status: 'inactive' }]);
			expect(calls(fetch).at(-1)).toMatch(/^GET \/flows\?/);
			expect(rowStatus('bo_webhook')).toBe(t('inactive'));
		},
		SLOW,
	);

	test(
		'row menu: an error on the status change opens the error dialog and the store is unchanged',
		async () => {
			await setup();
			const before = useFlowsStore().flows.find((f) => f.name === 'bo_event')!.status;
			fetch.mockImplementationOnce(async () =>
				json({ errors: [{ message: 'No', extensions: { code: 'FORBIDDEN' } }] }, 403),
			);
			await openRowMenu('bo_event');
			await chooseMenu(t('set_flow_inactive'));

			expect(useFlowsStore().flows.find((f) => f.name === 'bo_event')!.status).toBe(before);
			expect(document.querySelector('[role="alertdialog"], [role="dialog"]')).not.toBeNull();
		},
		SLOW,
	);

	test(
		'row menu: delete asks first (Cancel focused), DELETE /flows/<id> then GET /flows',
		async () => {
			await setup();
			const id = useFlowsStore().flows.find((f) => f.name === 'bo_orphan')!.id;
			await openRowMenu('bo_orphan');
			await chooseMenu(t('delete_flow'));

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('flow_delete_confirm', { flow: 'bo_orphan' }));
			const confirm = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_label'))!;
			confirm.click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain(`DELETE /flows/${id}`);
			expect(rowNames()).not.toContain('bo_orphan');
		},
		SLOW,
	);

	test(
		'no flows: the blank state with the create button',
		async () => {
			await setup({}, { hydrated: false });
			expect(document.body.textContent).toContain(t('no_flows'));
			expect(document.body.textContent).toContain(t('no_flows_copy'));
		},
		SLOW,
	);
});

describe('FlowDrawer', () => {
	test(
		'create: defaults, trigger tab locked without a name, Next, options reset, POST /flows with every value, navigate',
		async () => {
			const { router, wrapper } = await setup({ 'POST /flows': { id: 'f-new' } });
			button(t('create_flow'))!.click();
			await flushPromises();

			const drawer = wrapper.findComponent(FlowDrawer);
			const vm = drawer.vm as unknown as { values: Record<string, unknown> };
			expect({ ...vm.values }).toEqual({
				name: null,
				icon: 'bolt',
				color: null,
				description: null,
				status: 'active',
				accountability: 'all',
				trigger: undefined,
				options: {},
			});
			expect(document.querySelector('[role="tab"][data-disabled]')?.textContent).toContain(t('trigger_setup'));
			expect(button(t('next'))!.disabled).toBe(true);

			vm.values['name'] = 'My flow';
			await flushPromises();
			button(t('next'))!.click();
			await flushPromises();
			expect(button(t('finish_setup'))!.disabled).toBe(true);

			drawer.findComponent(BoFancySelect).vm.$emit('update:modelValue', 'event');
			await flushPromises();
			drawer.findComponent(BoForm).vm.$emit('update:modelValue', { type: 'action', scope: ['items.create'] });
			await flushPromises();
			drawer.findComponent(BoForm).vm.$emit('update:modelValue', { type: 'filter', scope: ['items.create'] });
			await flushPromises();
			expect(vm.values['options']).toEqual({ type: 'filter' });

			drawer.findComponent(BoFancySelect).vm.$emit('update:modelValue', 'manual');
			await flushPromises();
			expect(vm.values['options']).toEqual({});

			button(t('finish_setup'))!.click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain('POST /flows?fields=id');
			expect(bodies('POST', /^\/flows$/)).toEqual([
				{
					name: 'My flow',
					icon: 'bolt',
					color: null,
					description: null,
					status: 'active',
					accountability: 'all',
					trigger: 'manual',
					options: {},
				},
			]);
			expect(router.currentRoute.value.fullPath).toBe('/settings/flows/f-new');
		},
		SLOW,
	);

	test(
		'edit: the stored values, Save on the first tab sends PATCH with every value, the drawer closes, no navigation',
		async () => {
			const { router, wrapper } = await setup();
			const flow = useFlowsStore().flows.find((f) => f.name === 'bo_webhook')!;
			await openRowMenu('bo_webhook');
			await chooseMenu(t('edit_flow'));

			const vm = wrapper.findComponent(FlowDrawer).vm as unknown as { values: Record<string, unknown> };
			expect(vm.values['trigger']).toBe('webhook');
			expect(vm.values['options']).toEqual(flow.options);
			vm.values['description'] = 'Hook';
			await flushPromises();
			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain(`PATCH /flows/${flow.id}?fields=id`);
			expect(bodies('PATCH', /^\/flows\/[^/]+$/)[0]).toMatchObject({
				name: 'bo_webhook',
				description: 'Hook',
				trigger: 'webhook',
			});
			expect(router.currentRoute.value.name).toBe('settings-flows-collection');
			expect(wrapper.findComponent(FlowDrawer).props('active')).toBe(false);
		},
		SLOW,
	);

	test(
		'a save error opens the error dialog and keeps the drawer open with its values',
		async () => {
			const { wrapper } = await setup({
				'POST /flows': () => json({ errors: [{ message: 'Bad', extensions: { code: 'INVALID_PAYLOAD' } }] }, 400),
			});
			button(t('create_flow'))!.click();
			await flushPromises();
			const drawer = wrapper.findComponent(FlowDrawer);
			const vm = drawer.vm as unknown as { values: Record<string, unknown> };
			vm.values['name'] = 'Broken';
			await flushPromises();
			button(t('next'))!.click();
			await flushPromises();
			drawer.findComponent(BoFancySelect).vm.$emit('update:modelValue', 'schedule');
			await flushPromises();
			button(t('finish_setup'))!.click();
			await flushPromises();
			await flushPromises();

			expect(drawer.props('active')).toBe(true);
			expect(vm.values['name']).toBe('Broken');
		},
		SLOW,
	);
});
