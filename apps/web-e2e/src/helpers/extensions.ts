// Spec 020: a registry extension is uninstalled only once every API node of the parity env has loaded it. A node that
// syncs extensions/.registry/* while the files are deleted reads a missing file, and Directus exits on that (NoSuchKey).
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { AdminApi } from './api.js';
import { apiUrl, directusUrl, isCors } from './config.js';

/**
 * Directus, the Backoffice API of the main pair and the API of the configuration. The cors API (8163) has its own Redis
 * namespaces: no node reloads on its bus message, so there only that API loads what it installs.
 */
const NODES = isCors ? [apiUrl] : [...new Set([directusUrl, 'http://127.0.0.1:8156', apiUrl])];

export async function loadedEverywhere(request: APIRequestContext, id: string): Promise<void> {
	const apis = NODES.map((url) => new AdminApi(request, url));
	await expect
		.poll(
			async () => {
				const lists = await Promise.all(
					apis.map((api) => api.call<{ id: string; schema: unknown }[]>('GET', '/extensions')),
				);
				return lists.every((rows) => rows.some((row) => row.id === id && row.schema));
			},
			{ timeout: 30_000 },
		)
		.toBe(true);
}
