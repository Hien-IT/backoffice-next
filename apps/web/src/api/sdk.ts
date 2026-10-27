// Ported from directus/app/src/sdk.ts
// Backoffice: one client for every request (FR-001): the DR app also has an axios client (api.ts), whose
// request queue and requests store are folded into the fetch wrapper below. The base URL is apiUrl of config.json
// (the API may be on another origin), not the page URL.
import type { AuthenticationClient, DirectusClient, RequestOptions, RestClient, RestCommand } from '@directus/sdk';
import { authentication, createDirectus, rest } from '@directus/sdk';
import PQueue, { type Options, type QueueAddOptions } from 'p-queue';
import { SDK_AUTH_REFRESH_BEFORE_EXPIRES } from '../constants.ts';
import { useRequestsStore } from '../stores/requests.ts';

export type SdkClient = DirectusClient<unknown> & AuthenticationClient<unknown> & RestClient<unknown>;

// Ported from directus/app/src/api.ts
export let requestQueue: PQueue = new PQueue({
	concurrency: 5,
	intervalCap: 5,
	interval: 500,
	carryoverConcurrencyCount: true,
});

export function resumeQueue() {
	if (!requestQueue.isPaused) return;
	requestQueue.start();
}

export async function replaceQueue(options?: Options<any, QueueAddOptions>) {
	await requestQueue.onIdle();
	requestQueue = new PQueue(options);
}

let apiUrl = '/';
let apiBase = new URL('/', 'http://localhost');

/** Absolute base URL of the API, ending with "/". */
export function getApiUrl(): string {
	return apiBase.href;
}

/** Path of a request URL relative to the API base ("/auth/refresh"), or null when it is not an API URL. */
export function getApiPath(url: string): string | null {
	try {
		const { href, pathname } = new URL(url, apiBase);
		if (!href.startsWith(apiBase.href)) return null;
		return '/' + pathname.slice(apiBase.pathname.length);
	} catch {
		return null;
	}
}

async function wrappedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const requestsStore = useRequestsStore();
	const id = requestsStore.startRequest();
	const path = getApiPath(input instanceof Request ? input.url : String(input));

	try {
		await new Promise<void>((resolve) => {
			if (path === '/auth/refresh') {
				requestQueue.pause();
				return resolve();
			}

			requestQueue.add(() => resolve());
		});

		const response = await fetch(input, init);

		return response;
	} finally {
		// Backoffice: the state, not the endRequest action, which would make the pinia of the request's start the active
		// one again when the answer comes after a test set its own (see stores/requests.ts).
		requestsStore.queue.delete(id);

		// Backoffice: the SDK's own timed refresh also pauses the queue; resume it once the refresh answered.
		if (path === '/auth/refresh') resumeQueue();
	}
}

/** Raw request through the same queue and requests store, for answers the SDK would cut down to `data`. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	return wrappedFetch(new URL(path.replace(/^\//, ''), apiBase).href, { credentials: 'include', ...init });
}

export let sdk: SdkClient;

export function createSdk(url: string): SdkClient {
	apiUrl = url;
	apiBase = new URL(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`, window.location.href);

	sdk = createDirectus(apiBase.href, { globals: { fetch: wrappedFetch } })
		.with(
			authentication('session', { credentials: 'include', msRefreshBeforeExpires: SDK_AUTH_REFRESH_BEFORE_EXPIRES }),
		)
		.with(rest({ credentials: 'include' }));

	return sdk;
}

/**
 * Creates a RestCommand for the SDK
 *
 * This helper function allows sending a RestCommand when the endpoint path is dynamic
 */
export function requestEndpoint<Output = unknown>(
	path: string,
	options: Omit<RequestOptions, 'body' | 'path'> & { body?: Record<string, unknown> | unknown[] } = {},
): RestCommand<Output, never> {
	const { body: data, ...rest } = options;
	let body: undefined | string;

	if (data) {
		body = JSON.stringify(data);
	}

	return () => ({
		...rest,
		path,
		...(body !== undefined && { body }),
	});
}
