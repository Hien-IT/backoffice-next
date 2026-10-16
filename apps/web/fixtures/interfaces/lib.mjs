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

// Feature 015 (Files and Users modules, data-model §11): a folder tree of its own (the 013 `bo-fixtures` folder and
// snapshot stay as they are), the role under bo-editor and directory users, one per status, a token user and an SSO
// user (test values; they only exist on test databases).
export const FILES_ROOT = 'bo-files';
export const FILES_FOLDERS = { root: FILES_ROOT, sub: 'bo-files-sub', deep: 'bo-files-deep' };
export const SUB_ROLE = 'bo-sub';
export const DIRECTORY_USERS = {
	'bo-active': { email: 'bo-active@example.com', status: 'active', first_name: 'Ada', last_name: 'Active' },
	'bo-suspended': { email: 'bo-suspended@example.com', status: 'suspended', first_name: 'Sam', last_name: 'Suspended' },
	'bo-invited': { email: 'bo-invited@example.com', status: 'invited', first_name: null, last_name: null },
	'bo-draft': { email: 'bo-draft@example.com', status: 'draft', first_name: 'Dee', last_name: 'Draft' },
	'bo-archived': { email: 'bo-archived@example.com', status: 'archived', first_name: 'Archie', last_name: 'Archived' },
	'bo-token': { email: 'bo-token@example.com', status: 'active', first_name: 'Toby', last_name: 'Token' },
	'bo-sso': { email: 'bo-sso@example.com', status: 'active', first_name: 'Sasha', last_name: 'Sso' },
};

// Feature 016 (Settings module, data-model §15): a role under bo-editor with an app-access policy holding three
// permissions on bo_std (read all, create of two fields with a preset and a validation, update of rows that have
// input_string), and one
// custom translation in two languages. No collection: the 016 E2E specs create and remove their own, so the 013-015
// collection trees and snapshots stay as they are.
export const SETTINGS = { role: 'bo-settings-role', policy: 'bo-settings-policy', translationKey: 'bo_hello' };

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
