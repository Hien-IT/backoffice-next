import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useRequestsStore } from '../stores/requests.ts';
import { API, json, mockApi } from '../test-utils/fetch.ts';
import {
	apiFetch,
	createSdk,
	getApiPath,
	getApiUrl,
	replaceQueue,
	requestEndpoint,
	requestQueue,
	resumeQueue,
	sdk,
} from './sdk.ts';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('createSdk', () => {
	test('resolves a relative apiUrl against the page and keeps a sub path', () => {
		createSdk('/');
		expect(getApiUrl()).toBe(new URL('/', window.location.href).href);

		createSdk('https://api.example.com/base');
		expect(getApiUrl()).toBe('https://api.example.com/base/');
		expect(getApiPath('https://api.example.com/base/auth/refresh')).toBe('/auth/refresh');
		expect(getApiPath('https://other.example.com/auth/refresh')).toBeNull();
	});
});

describe('wrapped fetch', () => {
	test('sends cookies and counts the request in the requests store', async () => {
		const fetch = mockApi({ 'GET /server/info': { project: null } });
		const requests = useRequestsStore();

		const pending = sdk.request(requestEndpoint('/server/info', { method: 'GET' }));
		await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
		await pending;

		expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'include' });
		expect(requests.queueHasItems).toBe(false);
	});

	test('pauses the queue during /auth/refresh and resumes it after the answer', async () => {
		let release!: () => void;
		const refreshDone = new Promise<void>((resolve) => (release = resolve));

		const fetch = mockApi({
			'POST /auth/refresh': async () => {
				await refreshDone;
				return json({ data: { expires: 900000 } });
			},
			'GET /server/info': {},
		});

		const refreshing = sdk.refresh();
		await vi.waitFor(() => expect(requestQueue.isPaused).toBe(true));

		const info = sdk.request(requestEndpoint('/server/info', { method: 'GET' }));
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(fetch).toHaveBeenCalledTimes(1);

		release();
		await refreshing;
		await info;

		expect(requestQueue.isPaused).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(2);
		sdk.stopRefreshing();
	});

	test('apiFetch returns the raw response', async () => {
		mockApi({ 'GET /auth': () => json({ data: [], disableDefault: true }) });

		const response = await apiFetch('/auth?sessionOnly');

		expect(await response.json()).toEqual({ data: [], disableDefault: true });
	});
});

describe('queue helpers', () => {
	test('resumeQueue only starts a paused queue, replaceQueue swaps it', async () => {
		requestQueue.pause();
		resumeQueue();
		expect(requestQueue.isPaused).toBe(false);
		resumeQueue();

		const before = requestQueue;
		await replaceQueue({ intervalCap: 1, interval: 10 });
		expect(requestQueue).not.toBe(before);
	});
});

test('requestEndpoint serializes the body', () => {
	const command = requestEndpoint('/users/me', { method: 'PATCH', body: { a: 1 } });
	expect(command()).toEqual({ method: 'PATCH', path: '/users/me', body: '{"a":1}' });
	expect(API).toBe('http://api.test/');
});
