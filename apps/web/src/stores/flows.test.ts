// Ported from directus/app/src/stores/flows.test.ts
// Backoffice: the API is mocked with mockApi (fetch); tests after the DR ones cover the request, the
// permission and error paths and isActiveFlow.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { useFlowsStore } from './flows.ts';
import { usePermissionsStore } from './permissions.ts';
import { useUserStore } from './user.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => vi.unstubAllGlobals());

const mockFlows = [
	{
		id: 'f1',
		name: 'Flow 1',
		status: 'active',
		trigger: 'manual',
		accountability: 'all',
		options: {
			collections: ['a'],
		},
	},
	{
		id: 'f2',
		name: 'Flow 2',
		status: 'inactive',
		trigger: 'event',
		accountability: 'all',
		options: {
			type: 'action',
			scope: ['items.create'],
			collections: ['a'],
		},
	},
	{
		id: 'f3',
		name: 'Flow 3',
		status: 'inactive',
		trigger: 'manual',
		accountability: 'all',
		options: {
			collections: ['a'],
		},
	},
	{
		id: 'f4',
		name: 'Flow 4',
		status: 'active',
		trigger: 'manual',
		accountability: 'all',
		options: {
			collections: ['b'],
		},
	},
];

const mockAdminUser = { admin_access: true } as AppUser;
const mockNonAdminUser = { admin_access: false } as AppUser;

let fetch: ReturnType<typeof mockApi>;

beforeEach(() => {
	fetch = mockApi({ 'GET /flows': mockFlows });
});

test('hydrate action for admin', async () => {
	const userStore = useUserStore();
	userStore.currentUser = mockAdminUser;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();

	expect(flowsStore.flows).toEqual(mockFlows);
});

test('hydrate action for non-admin', async () => {
	const userStore = useUserStore();
	userStore.currentUser = mockNonAdminUser;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();

	expect(flowsStore.flows).toEqual([]);
	expect(fetch).not.toHaveBeenCalled();
});

test('dehydrate action resets store', async () => {
	const userStore = useUserStore();
	userStore.currentUser = mockAdminUser;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();
	await flowsStore.dehydrate();

	expect(flowsStore.flows).toEqual([]);
});

test('getManualFlowsForCollection action returns active manual flows of specified collection only', async () => {
	const userStore = useUserStore();
	userStore.currentUser = mockAdminUser;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();

	const testCollection = 'a';

	expect(flowsStore.getManualFlowsForCollection(testCollection)).toEqual(
		mockFlows.filter(
			(flow) =>
				flow.trigger === 'manual' && flow.status === 'active' && flow.options?.collections?.includes(testCollection),
		),
	);
});

test('hydrate requests the fields of Directus for a user with read permission on directus_flows', async () => {
	useUserStore().currentUser = mockNonAdminUser;
	usePermissionsStore().permissions = { directus_flows: { read: { access: 'full' } } } as never;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();

	expect(calls(fetch)).toEqual(['GET /flows?fields=*,operations.*&limit=-1']);
	expect(flowsStore.flows).toHaveLength(4);
});

test('hydrate keeps an empty list when the request fails', async () => {
	mockApi({ 'GET /flows': () => json({ errors: [{ message: 'boom' }] }, 500) });
	useUserStore().currentUser = mockAdminUser;

	const flowsStore = useFlowsStore();
	flowsStore.flows = mockFlows as never;

	await expect(flowsStore.hydrate()).resolves.toBeUndefined();
	expect(flowsStore.flows).toEqual([]);
});

test('isActiveFlow is true for a loaded active flow only', async () => {
	useUserStore().currentUser = mockAdminUser;

	const flowsStore = useFlowsStore();
	await flowsStore.hydrate();

	expect(flowsStore.isActiveFlow('f1')).toBe(true);
	expect(flowsStore.isActiveFlow('f3')).toBe(false);
	expect(flowsStore.isActiveFlow('missing')).toBe(false);
});
