// Backoffice (spec 029, T030): the passkey probe of the login form and the user page.
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch, getApiUrl } from '../api/sdk.ts';
import { _resetPasskeySupport, usePasskeySupport } from './use-passkey-support.ts';

vi.mock('@simplewebauthn/browser', () => ({ browserSupportsWebAuthn: vi.fn() }));
vi.mock('../api/sdk.ts', () => ({ apiFetch: vi.fn(), getApiUrl: vi.fn() }));

const answer = (status: number, body: unknown = {}) =>
	({ ok: status < 400, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
	_resetPasskeySupport();
	vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
	vi.mocked(getApiUrl).mockReturnValue('http://localhost:3000/');
});

afterEach(() => {
	vi.clearAllMocks();
});

test('no WebAuthn in the browser: false, no request', async () => {
	vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);

	await expect(usePasskeySupport().ready).resolves.toBe(false);
	expect(apiFetch).not.toHaveBeenCalled();
});

test('a Directus API (404) or a network error: false', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(404));
	await expect(usePasskeySupport().ready).resolves.toBe(false);

	_resetPasskeySupport();
	vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
	await expect(usePasskeySupport().ready).resolves.toBe(false);
});

test('an RP ID other than the page host: false; the page host: true', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: { rp_id: 'other.example.com' } }));
	await expect(usePasskeySupport().ready).resolves.toBe(false);

	_resetPasskeySupport();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200, { data: { rp_id: window.location.hostname } }));
	const { passkeyAvailable, ready } = usePasskeySupport();

	await expect(ready).resolves.toBe(true);
	expect(passkeyAvailable.value).toBe(true);
	expect(apiFetch).toHaveBeenCalledWith('/backoffice/auth/passkey', { method: 'GET' });
});

test('one request per API URL; a new API URL asks again', async () => {
	vi.mocked(apiFetch).mockResolvedValue(answer(200, { data: { rp_id: window.location.hostname } }));

	await usePasskeySupport().ready;
	await usePasskeySupport().ready;
	expect(apiFetch).toHaveBeenCalledTimes(1);

	vi.mocked(getApiUrl).mockReturnValue('http://localhost:4000/');
	await usePasskeySupport().ready;
	expect(apiFetch).toHaveBeenCalledTimes(2);
});
