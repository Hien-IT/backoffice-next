// Admin calls the specs make to set up and clean their data, on the API of the configuration (Directus behind
// proxy-directus, the new API otherwise). JSON-mode login: the token stays out of the page's cookies. The `cors` pair has
// ACCESS_TOKEN_TTL=30s, so the token is renewed by a new login shortly before it expires.
import type { APIRequestContext } from '@playwright/test';
import { ADMIN, apiUrl } from './config.js';

type Item = Record<string, unknown> & { id: string };
type FilePayload = { name: string; mimeType: string; buffer: Buffer };

export class AdminApi {
	private token: string | undefined;
	private expiresAt = 0;

	constructor(
		private readonly request: APIRequestContext,
		private readonly baseUrl: string = apiUrl,
	) {}

	private async accessToken(): Promise<string> {
		if (this.token && Date.now() < this.expiresAt - 5_000) return this.token;
		const response = await this.request.post(`${this.baseUrl}/auth/login`, { data: ADMIN });
		if (!response.ok()) throw new Error(`admin login: ${response.status()} ${await response.text()}`);
		const { data } = (await response.json()) as { data: { access_token: string; expires: number } };
		this.token = data.access_token;
		this.expiresAt = Date.now() + data.expires;
		return this.token;
	}

	/** One call as the admin; returns `data` of the answer (undefined for 204). */
	async call<T = unknown>(
		method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
		path: string,
		options: { data?: unknown; multipart?: Record<string, string | FilePayload> } = {},
	): Promise<T> {
		const response = await this.request.fetch(`${this.baseUrl}${path}`, {
			method,
			headers: { Authorization: `Bearer ${await this.accessToken()}` },
			...options,
		});

		if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()} ${await response.text()}`);
		const text = await response.text();
		if (response.status() === 204 || !text) return undefined as T;
		return (JSON.parse(text) as { data: T }).data;
	}

	createUser(user: Record<string, unknown>) {
		return this.call<Item>('POST', '/users', { data: user });
	}

	deleteUser(id: string) {
		return this.call('DELETE', `/users/${id}`);
	}

	createRole(role: Record<string, unknown>) {
		return this.call<Item>('POST', '/roles', { data: role });
	}

	deleteRole(id: string) {
		return this.call('DELETE', `/roles/${id}`);
	}

	createPolicy(policy: Record<string, unknown>) {
		return this.call<Item>('POST', '/policies', { data: policy });
	}

	deletePolicy(id: string) {
		return this.call('DELETE', `/policies/${id}`);
	}

	createShare(share: Record<string, unknown>) {
		return this.call<Item>('POST', '/shares', { data: share });
	}

	deleteShare(id: string) {
		return this.call('DELETE', `/shares/${id}`);
	}

	getSettings() {
		return this.call<Record<string, unknown>>('GET', '/settings');
	}

	patchSettings(settings: Record<string, unknown>) {
		return this.call<Record<string, unknown>>('PATCH', '/settings', { data: settings });
	}

	/** POST /files (multipart); returns the file row. */
	uploadFile(file: FilePayload, fields: Record<string, string> = {}) {
		// Fields before the file: Directus reads them before the file part.
		return this.call<Item>('POST', '/files', { multipart: { ...fields, file } });
	}

	deleteFile(id: string) {
		return this.call('DELETE', `/files/${id}`);
	}
}
