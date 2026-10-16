// Ported from directus/app/src/modules/settings/routes/policies/use-duplicate.test.ts
// Backoffice: the requests go through the SDK, so the fetch is stubbed (mockApi) instead of mocking `@/api`; the
// assertions read the request bodies and query of the stub (a pinia is active for the SDK fetch wrapper).
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { replaceQueue } from '../../../../api/sdk.ts';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { calls, mockApi } from '../../../../test-utils/fetch.ts';
import { type PolicyItem, useDuplicate } from './use-duplicate.ts';

const source: PolicyItem = {
	id: 'policy-abc',
	name: 'Editor',
	icon: 'supervised_user_circle',
	description: 'Can edit content',
	enforce_tfa: false,
	ip_access: null,
	app_access: true,
	admin_access: false,
	userCount: 3,
	roleCount: 1,
} as PolicyItem;

beforeEach(async () => {
	setActivePinia(createPinia());
	resetNotices();
	await replaceQueue();
});

afterEach(() => vi.unstubAllGlobals());

function api(permissions: unknown[]) {
	return mockApi({
		'GET /permissions': permissions,
		'POST /policies': { id: 'new-policy-id' },
		'POST /permissions': [],
	});
}

const posts = (fetch: ReturnType<typeof mockApi>) =>
	fetch.mock.calls
		.filter(([, init]) => init?.method === 'POST')
		.map(([input, init]) => [new URL(String(input)).pathname, JSON.parse(String(init!.body))]);

describe('useDuplicate', () => {
	it('POSTs to /policies with the expected shape derived from the source item', async () => {
		const fetch = api([]);

		const { duplicate } = useDuplicate({
			source: ref(source),
			name: ref('Editor (copy)'),
			onSuccess: vi.fn(),
		});

		await duplicate();

		expect(calls(fetch)[0]).toBe(
			'GET /permissions?fields=collection,action,permissions,validation,presets,fields,policy&filter={"policy":{"_eq":"policy-abc"}}&limit=-1',
		);
		expect(posts(fetch)[0]).toEqual([
			'/policies',
			{
				name: 'Editor (copy)',
				icon: 'supervised_user_circle',
				description: 'Can edit content',
				enforce_tfa: false,
				ip_access: null,
				app_access: true,
				admin_access: false,
			},
		]);
	});

	it('does not copy users or roles onto the new policy', async () => {
		const fetch = api([]);

		const { duplicate } = useDuplicate({
			source: ref(source),
			name: ref('Editor (copy)'),
			onSuccess: vi.fn(),
		});

		await duplicate();

		const postedPolicy = posts(fetch)[0]![1];
		expect(postedPolicy).not.toHaveProperty('users');
		expect(postedPolicy).not.toHaveProperty('roles');
	});

	it('POSTs permissions with the new policy id and without the original policy id', async () => {
		const fetch = api([
			{
				collection: 'articles',
				action: 'read',
				permissions: null,
				validation: null,
				presets: null,
				fields: ['*'],
				policy: source.id,
			},
			{
				collection: 'articles',
				action: 'create',
				permissions: null,
				validation: null,
				presets: null,
				fields: null,
				policy: source.id,
			},
		]);

		const onSuccess = vi.fn();

		const { duplicate } = useDuplicate({
			source: ref(source),
			name: ref('Editor (copy)'),
			onSuccess,
		});

		await duplicate();

		expect(posts(fetch)[1]).toEqual([
			'/permissions',
			[
				{
					collection: 'articles',
					action: 'read',
					permissions: null,
					validation: null,
					presets: null,
					fields: ['*'],
					policy: 'new-policy-id',
				},
				{
					collection: 'articles',
					action: 'create',
					permissions: null,
					validation: null,
					presets: null,
					fields: null,
					policy: 'new-policy-id',
				},
			],
		]);
		expect(onSuccess).toHaveBeenCalledOnce();
	});

	it('skips the permissions POST when the source policy has no permissions', async () => {
		const fetch = api([]);

		const { duplicate } = useDuplicate({
			source: ref(source),
			name: ref('Editor (copy)'),
			onSuccess: vi.fn(),
		});

		await duplicate();

		// Only the policy POST should have been called
		expect(posts(fetch)).toHaveLength(1);
		expect(posts(fetch)[0]![0]).toBe('/policies');
	});
});
