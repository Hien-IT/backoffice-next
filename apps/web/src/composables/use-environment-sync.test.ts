// Backoffice (spec 032, D-214.1, T044): the probe of the Environment Sync entry of Settings.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch, getApiUrl } from '../api/sdk.ts';
import { _resetEnvironmentSync, useEnvironmentSync } from './use-environment-sync.ts';

vi.mock('../api/sdk.ts', () => ({ apiFetch: vi.fn(), getApiUrl: vi.fn() }));

const answer = (status: number) => ({ ok: status < 400, status }) as unknown as Response;

beforeEach(() => {
	_resetEnvironmentSync();
	vi.mocked(getApiUrl).mockReturnValue('http://localhost:3000/');
});

afterEach(() => vi.clearAllMocks());

test('Backoffice (200): available', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(200));
	const { ready, available } = useEnvironmentSync();
	await expect(ready).resolves.toBe(true);
	expect(available.value).toBe(true);
	expect(apiFetch).toHaveBeenCalledWith('/backoffice/sync', { method: 'GET' });
});

test('a DR API (404), a user who is not admin (403) or a network error: not available, silently', async () => {
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(404));
	await expect(useEnvironmentSync().ready).resolves.toBe(false);

	_resetEnvironmentSync();
	vi.mocked(apiFetch).mockResolvedValueOnce(answer(403));
	await expect(useEnvironmentSync().ready).resolves.toBe(false);

	_resetEnvironmentSync();
	vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
	await expect(useEnvironmentSync().ready).resolves.toBe(false);
});

test('one probe per API URL', async () => {
	vi.mocked(apiFetch).mockResolvedValue(answer(200));
	await useEnvironmentSync().ready;
	await useEnvironmentSync().ready;
	expect(apiFetch).toHaveBeenCalledTimes(1);

	vi.mocked(getApiUrl).mockReturnValue('http://other/');
	await useEnvironmentSync().ready;
	expect(apiFetch).toHaveBeenCalledTimes(2);
});
