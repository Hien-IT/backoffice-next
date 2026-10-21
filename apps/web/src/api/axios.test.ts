// Spec 020 (T104): the axios client of useApi() goes to the API URL of config.json, waits for the SDK token (a running
// refresh), counts in the requests store and sends the session cookie.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test, vi } from 'vitest';
import { useRequestsStore } from '../stores/requests.ts';
import api from './axios.ts';
import { createSdk, sdk } from './sdk.ts';

beforeEach(() => {
	setActivePinia(createPinia());
	createSdk('https://api.example.com/cms/');
});

test('baseURL from config.json, credentials, the requests store and the token wait', async () => {
	const getToken = vi.spyOn(sdk, 'getToken').mockResolvedValue(null);
	const seen: Record<string, unknown> = {};

	const result = await api.get('/items/a', {
		adapter: async (config) => {
			Object.assign(seen, {
				baseURL: config.baseURL,
				withCredentials: config.withCredentials,
				queued: useRequestsStore().queueHasItems,
			});
			return { data: { data: 1 }, status: 200, statusText: 'OK', headers: {}, config };
		},
	});

	expect(result.data).toEqual({ data: 1 });
	expect(seen).toEqual({ baseURL: 'https://api.example.com/cms/', withCredentials: true, queued: true });
	expect(getToken).toHaveBeenCalled();
	expect(useRequestsStore().queueHasItems).toBe(false);
});
