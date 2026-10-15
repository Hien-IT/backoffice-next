// Shared helpers of seed.mjs and export.mjs: arguments, a small REST client and the test users of the fixture set.
import { parseArgs } from 'node:util';

// Test values for the fixture users (documented in README.md); they only exist on test databases.
export const USERS = {
	'bo-editor': { email: 'bo-editor@example.com', password: 'bo-editor-test-password' },
	'bo-viewer': { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' },
};

export const FOLDER = 'bo-fixtures';

// uuid values that are data, not ids: export.mjs keeps them as they are.
export const FIXED_UUIDS = ['6f9619ff-8b86-4d11-b42d-00c04fc964ff'];
export const FLOW = 'bo-flow';

// Feature 014 (Content module): manual flows on bo_content, the share of bo_content/1 and its password (test value).
export const CONTENT_FLOWS = ['bo-flow-content', 'bo-flow-item'];
export const SHARE = { name: 'bo-share', password: 'bo-share-password' };

/** `--api <url>` plus `--token <token>` or `--email <e> --password <p>`; `--clean` for seed.mjs; `--out <dir>` and `--kind <directus|backoffice>` for export.mjs. */
export function readArgs() {
	const { values } = parseArgs({
		options: {
			api: { type: 'string' },
			token: { type: 'string' },
			email: { type: 'string' },
			password: { type: 'string' },
			out: { type: 'string' },
			kind: { type: 'string' },
			clean: { type: 'boolean' },
		},
		strict: false,
	});

	if (!values.api) throw new Error('Missing --api <url>');
	if (!values.token && !(values.email && values.password))
		throw new Error('Missing --token <admin token> or --email <email> --password <password>');

	return values;
}

export class Api {
	constructor(url, token) {
		this.url = url.replace(/\/$/, '');
		this.token = token;
	}

	static async connect({ api, token, email, password }) {
		const client = new Api(api, token);
		if (!token) await client.login(email, password);
		return client;
	}

	async login(email, password) {
		const { access_token } = await this.request('POST', '/auth/login', { email, password });
		this.token = access_token;
		return this;
	}

	/** JSON request; returns `data`, throws with the API errors on a non-2xx answer. */
	async request(method, path, body) {
		const isForm = body instanceof FormData;

		const response = await fetch(this.url + path, {
			method,
			headers: {
				...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
				...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
			},
			body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
		});

		if (response.status === 204) return null;
		const text = await response.text();
		const json = text ? JSON.parse(text) : null;

		if (!response.ok) {
			const error = new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json?.errors ?? text)}`);
			error.status = response.status;
			throw error;
		}

		return json?.data ?? null;
	}

	get(path) {
		return this.request('GET', path);
	}
}

/** `?a=b&c=d` from an object; object values are JSON encoded (filter, deep). */
export function query(params) {
	const search = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		search.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
	}

	return `?${search}`;
}
