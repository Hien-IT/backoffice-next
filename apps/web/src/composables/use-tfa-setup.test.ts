// Feature 015 (T072, FR-082): the TFA actions of the system-mfa-setup interface; generate/enable stay covered by
// TfaSetupRoute.test.ts.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { logout } from '../auth.ts';
import { useUserStore } from '../stores/user.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import type { AppUser } from '../types/user.ts';
import { useTFASetup } from './use-tfa-setup.ts';

vi.mock('../auth.ts', () => ({ logout: vi.fn(async () => {}) }));

const KEY = 'backoffice-require_tfa_setup';

function setup(initialEnabled = true) {
	let result!: ReturnType<typeof useTFASetup>;

	mount(
		defineComponent({
			setup() {
				result = useTFASetup(initialEnabled);
				return () => null;
			},
		}),
	);

	return result;
}

function signIn(id = 'me-id') {
	useUserStore().currentUser = { id, provider: 'oidc' } as unknown as AppUser;
}

const hydrateAnswers = {
	'GET /users/me': { id: 'me-id' },
	'GET /policies/me/globals': { admin_access: false, app_access: true },
	'GET /roles/me': [],
};

beforeEach(() => {
	setActivePinia(createPinia());
	localStorage.clear();
	vi.mocked(logout).mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe('disableTFA', () => {
	test('posts the OTP to /users/me/tfa/disable, hydrates and clears the state', async () => {
		const fetch = mockApi({ 'POST /users/me/tfa/disable': null, ...hydrateAnswers });
		localStorage.setItem(KEY, 'me-id');
		const tfa = setup();
		tfa.otp.value = '123456';

		expect(await tfa.disableTFA()).toBe(true);
		expect(calls(fetch)[0]).toBe('POST /users/me/tfa/disable');
		expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body))).toEqual({ otp: '123456' });
		expect(calls(fetch)).toContain('GET /users/me?fields=*,role.id');
		expect(tfa.tfaEnabled.value).toBe(false);
		expect(tfa.otp.value).toBe('');
		expect(tfa.requireTfaSetup.value).toBeNull();
		expect(tfa.loading.value).toBe(false);
	});

	test('keeps TFA enabled and exposes the error when the API refuses', async () => {
		mockApi({
			'POST /users/me/tfa/disable': () =>
				json({ errors: [{ message: 'Invalid OTP', extensions: { code: 'INVALID_OTP' } }] }, 401),
		});
		const tfa = setup();

		expect(await tfa.disableTFA()).toBe(false);
		expect(tfa.tfaEnabled.value).toBe(true);
		expect(tfa.error.value).toBeTruthy();
	});
});

describe('adminDisableTFA', () => {
	test('posts to /users/<pk>/tfa/disable without a body and keeps the setup key of another user', async () => {
		const fetch = mockApi({ 'POST /users/other-id/tfa/disable': null });
		signIn();
		localStorage.setItem(KEY, 'me-id');
		const tfa = setup();

		expect(await tfa.adminDisableTFA('other-id')).toBe(true);
		expect(calls(fetch)).toEqual(['POST /users/other-id/tfa/disable']);
		expect(fetch.mock.calls[0]![1]!.body).toBeUndefined();
		expect(tfa.tfaEnabled.value).toBe(false);
		expect(tfa.requireTfaSetup.value).toBe('me-id');
	});

	test('clears the setup key when the admin disables their own TFA', async () => {
		mockApi({ 'POST /users/me-id/tfa/disable': null });
		signIn();
		localStorage.setItem(KEY, 'me-id');
		const tfa = setup();

		expect(await tfa.adminDisableTFA('me-id')).toBe(true);
		expect(tfa.requireTfaSetup.value).toBeNull();
	});
});

describe('requestTFASetup', () => {
	test('stores the current user id under backoffice-require_tfa_setup, then logs out', async () => {
		const fetch = mockApi({});
		signIn();
		const tfa = setup(false);

		expect(await tfa.requestTFASetup()).toBe(true);
		expect(localStorage.getItem(KEY)).toBe('me-id');
		expect(logout).toHaveBeenCalledTimes(1);
		expect(calls(fetch)).toEqual([]);
	});
});

describe('cancelTFASetup', () => {
	test('removes the key and hydrates the user', async () => {
		const fetch = mockApi(hydrateAnswers);
		localStorage.setItem(KEY, 'me-id');
		const tfa = setup(false);

		expect(await tfa.cancelTFASetup()).toBe(true);
		expect(tfa.requireTfaSetup.value).toBeNull();
		expect(localStorage.getItem(KEY)).toBeNull();
		expect(calls(fetch)).toContain('GET /users/me?fields=*,role.id');
	});
});
