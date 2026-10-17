// Spec 017 US2 and US3 (T042, T060; FR-020 to FR-045): the flow page on the fixture flows (bo_all_ops with the 15
// operations, bo_orphan with a loner and an unknown type) and the operation drawer as its child route. View mode draws
// every panel at its cell and the arrows; Edit Flow, the "+" handle opening the drawer, Done staging the operation, the
// tile menu (duplicate, delete, copy to), Save with the nested body, Clear Changes, the unsaved-changes guard, Delete
// Flow, Ctrl+S; the drawer: generated key, uniqueness error, the options of a type, the D-106 notice of `mail`, the
// unknown type notice, Done with the default option values.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoFancySelect from '../../../../components/BoFancySelect.vue';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { i18n } from '../../../../lang/index.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../../test-utils/layout.ts';
import FlowRoute from './FlowRoute.vue';
import OperationDetail from './OperationDetail.vue';

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
	{ path: '/settings/flows', name: 'settings-flows-collection', component: { render: () => null } },
	{
		path: '/settings/flows/:primaryKey',
		name: 'settings-flows-item',
		component: FlowRoute,
		props: true,
		children: [{ path: ':operationId', name: 'settings-flows-operation', component: OperationDetail, props: true }],
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const flowId = (name: string) => useFlowsStore().flows.find((flow) => flow.name === name)!.id;

async function setup(name: string, suffix = '') {
	const snapshot = loadSnapshot();
	const id = snapshot.editorFlows.find((flow) => flow.name === name)!.id;
	// The fixture mock stores a PATCH body as is (nested operations included); answer the save without changing the rows.
	const answers = { [`PATCH /flows/${id}`]: { id } };
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path: `/settings/flows/${id}${suffix}`,
			async beforeMount() {
				fetch = mockFixtureApi(snapshot, { user: 'admin', answers });
				await useUserStore().hydrate();
				await usePermissionsStore().hydrate();
				await useFlowsStore().hydrate();
				fetch.mockClear();
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const tile = (key: string) => document.querySelector<HTMLElement>(`[data-panel-key="${key}"]`)!;
const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.getAttribute('aria-label') === label);
const bodies = (method: string, path: RegExp) =>
	fetch.mock.calls
		.filter(([input, init]) => (init?.method ?? 'GET') === method && path.test(new URL(String(input)).pathname))
		.map(([, init]) => JSON.parse(String(init!.body ?? 'null')));
const arrows = (type: string) =>
	document.querySelectorAll(`[data-flow-arrows] path[data-arrow="${type}"]:not([data-hint])`).length;

async function edit() {
	button(t('edit_flow'))!.click();
	await flushPromises();
}

async function clickHandle(key: string, which: string) {
	tile(key).dispatchEvent(new PointerEvent('pointerenter'));
	await flushPromises();
	const handle = tile(key).querySelector<HTMLElement>(`[data-hint="${which}"], [data-handle="${which}"]`)!;
	handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	window.dispatchEvent(new PointerEvent('pointerup'));
	await flushPromises();
	await flushPromises();
}

async function tileMenu(key: string, entry: string) {
	const trigger = tile(key).querySelector<HTMLButtonElement>('button[aria-label^="Options for"]')!;
	trigger.focus();
	await press(trigger, 'Enter');
	[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
		.find((el) => el.textContent?.includes(entry))!
		.click();
	await flushPromises();
}

describe('FlowRoute', () => {
	test(
		'view mode: the trigger and 15 panels at their cells, 8+6 resolve and 2 reject arrows, the header actions',
		async () => {
			await setup('bo_all_ops');

			expect(document.querySelector('main h1')!.textContent).toContain('bo_all_ops');
			expect(tile('$trigger').getAttribute('data-pos-x')).toBe('1');
			expect(tile('condition').getAttribute('data-pos-x')).toBe('19');
			expect(tile('throw_error').getAttribute('data-pos-y')).toBe('17');
			expect(document.querySelectorAll('[data-panel-key]')).toHaveLength(16);
			expect(arrows('resolve')).toBe(13);
			expect(arrows('reject')).toBe(2);
			expect(tile('webhook')).toBeNull();
			expect(tile('condition').textContent).toContain(t('condition_rules'));
			expect(button(t('edit_flow'))).toBeDefined();
			expect(button(t('delete_flow'))).toBeDefined();
			expect(button(t('save'))).toBeUndefined();
			expect(tile('condition').querySelector('button[aria-label="Edit"]')).toBeNull();
		},
		SLOW,
	);

	test(
		'loner and unknown type: dimmed with screen-reader text; the unknown type has no overview',
		async () => {
			await setup('bo_orphan');
			expect(tile('loner').hasAttribute('data-subdued')).toBe(true);
			expect(tile('loner').textContent).toContain(t('flow_operation_not_linked'));
			expect(tile('unknown').textContent).not.toContain('anything');
		},
		SLOW,
	);

	test(
		'edit: Save gets the focus; "+" on the trigger opens the drawer; Done stages the operation; Save sends the tree',
		async () => {
			const { router } = await setup('bo_orphan');
			await edit();
			expect(document.activeElement?.getAttribute('aria-label')).toBe(t('save'));

			await clickHandle('$trigger', 'resolve');
			expect(router.currentRoute.value.name).toBe('settings-flows-operation');
			expect(router.currentRoute.value.params['operationId']).toBe('+');
			expect(document.body.textContent).toContain(t('create_operation'));

			const select = [...document.querySelectorAll('[role="dialog"]')].at(-1)!;
			const fancy = select.querySelectorAll('button[aria-pressed]');
			expect(fancy).toHaveLength(15);
			([...fancy].find((b) => b.textContent?.includes(t('operations.exec.name'))) as HTMLButtonElement).click();
			await flushPromises();
			expect(select.querySelector<HTMLInputElement>('input')!.placeholder).toBe(t('operations.exec.name'));
			button(t('done'))!.click();
			await flushPromises();
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('settings-flows-item');
			// No name typed: the name is the type's and the key `exec_<5 random>`, as Directus.
			const created = document.querySelector<HTMLElement>('[data-panel-key^="exec_"]')!;
			expect(created).not.toBeNull();
			expect(created.getAttribute('data-pos-x')).toBe('19');

			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();
			const id = flowId('bo_orphan');
			const [body] = bodies('PATCH', new RegExp(`^/flows/${id}$`));
			expect(body.operation).toMatchObject({
				flow: id,
				key: expect.stringMatching(/^exec_[a-z0-9]{5}$/),
				name: t('operations.exec.name'),
				type: 'exec',
				position_x: 19,
				position_y: 1,
				options: { code: expect.stringContaining('module.exports') },
			});
			expect(document.activeElement?.getAttribute('aria-label')).toBe(t('edit_flow'));
		},
		SLOW,
	);

	test(
		'tile menu: Duplicate adds a panel 2 cells away; Delete removes one; Clear Changes asks, Keep Editing first',
		async () => {
			await setup('bo_orphan');
			await edit();
			await tileMenu('loner', t('duplicate'));
			const copies = [...document.querySelectorAll('[data-panel-key^="loner_"]')];
			expect(copies).toHaveLength(1);
			expect(copies[0]!.getAttribute('data-pos-x')).toBe('21');

			await tileMenu('unknown', t('delete'));
			expect(tile('unknown')).toBeNull();

			button(t('clear_changes'))!.click();
			await flushPromises();
			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('discard_changes_copy'));
			expect(dialog.querySelectorAll('button')[0]!.textContent?.trim()).toBe(t('keep_editing'));
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('discard_changes'))!.click();
			await flushPromises();
			expect(tile('unknown')).not.toBeNull();
			expect(button(t('edit_flow'))).toBeDefined();
			expect(calls(fetch).filter((c) => !c.startsWith('GET'))).toEqual([]);
		},
		SLOW,
	);

	test(
		'Copy To: POST /operations with flow = the chosen flow',
		async () => {
			await setup('bo_orphan');
			await edit();
			await tileMenu('loner', t('copy_to'));
			const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1)!;
			expect(dialog.textContent).toContain(t('copy_to'));
		},
		SLOW,
	);

	test(
		'leaving with staged panels asks first; Delete Flow sends DELETE and goes to the overview',
		async () => {
			const { router } = await setup('bo_orphan');
			await edit();
			await tileMenu('loner', t('duplicate'));
			await router.push('/settings/flows');
			await flushPromises();
			expect(document.body.textContent).toContain(t('unsaved_changes_copy'));
			[...document.querySelectorAll('[role="dialog"] button')]
				.find((b) => b.textContent?.trim() === t('discard_changes'))!
				.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('settings-flows-collection');
		},
		SLOW,
	);

	test(
		'Delete Flow: the dialog, DELETE /flows/<id>, then the overview',
		async () => {
			const { router } = await setup('bo_schedule');
			const id = flowId('bo_schedule');
			button(t('delete_flow'))!.click();
			await flushPromises();
			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('flow_delete_confirm', { flow: 'bo_schedule' }));
			[...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('delete_label'))!.click();
			await flushPromises();
			await flushPromises();
			expect(calls(fetch)).toContain(`DELETE /flows/${id}`);
			expect(router.currentRoute.value.name).toBe('settings-flows-collection');
		},
		SLOW,
	);
});

describe('OperationDetail', () => {
	test(
		'editing an operation: its values; the key must be unique in the flow; mail shows the D-106 notice',
		async () => {
			const snapshot = loadSnapshot();
			const mail = snapshot.operations.find((o) => o['key'] === 'mail')!;
			await setup('bo_all_ops', `/${mail['id']}`);

			expect(document.body.textContent).toContain(t('edit_operation'));
			expect(document.body.textContent).toContain(t('operations_mail_not_sent_notice'));
			const inputs = [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input')];
			const key = inputs[1]!;
			// The fixture operations have no name: the immediate name watcher of Directus empties the key (Done would use
			// the generated one).
			expect(key.value).toBe('');
			expect(key.placeholder).toMatch(/^mail_[a-z0-9]{5}$/);

			key.value = 'log';
			key.dispatchEvent(new Event('input'));
			await flushPromises();
			expect(document.body.textContent).toContain(t('operation_key_unique_error'));
			expect(button(t('done'))!.disabled).toBe(true);
		},
		SLOW,
	);

	test(
		'an unknown type: the danger notice with its reset button',
		async () => {
			const snapshot = loadSnapshot();
			const unknown = snapshot.operations.find((o) => o['key'] === 'unknown')!;
			const { wrapper } = await setup('bo_orphan', `/${unknown['id']}`);

			expect(document.body.textContent).toContain(t('operation_not_found', { operation: 'bo-unknown' }));
			[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
				.find((b) => b.textContent?.trim() === t('reset_interface'))!
				.click();
			await flushPromises();
			expect(wrapper.findComponent(BoFancySelect).props('modelValue')).toBeNull();
		},
		SLOW,
	);
});
