// Backoffice (spec 032, D-214, research R2/R11): calls to the source Backoffice. The token goes in the Authorization
// header only; the URL, the token and the source's answers never reach a log line or an error message (FR-003, FR-004).
import { InvalidPayloadError, ServiceUnavailableError } from '@backoffice/errors';
import type { SchemaOverview } from '@backoffice/types';
import type { AxiosResponse } from 'axios';
import Joi from 'joi';
import { getAxios } from '../request/index.js';
import { TABLE_KINDS } from './groups.js';
import { columnsOf } from './state.js';
import { GROUP_KEYS, type GroupKey, type Row, type SyncInfo, type SyncState } from './types.js';

export const SOURCE_TIMEOUT = 30_000;
export const SOURCE_MAX_BYTES = 100 * 1024 * 1024;

const unavailable = (reason: string) => new ServiceUnavailableError({ service: 'sync', reason });

/** The base URL of the source without a trailing slash (a sub path is kept), or 400. */
export function normalizeUrl(raw: string): string {
	let url: URL;

	try {
		url = new URL(raw);
	} catch {
		throw new InvalidPayloadError({ reason: '"url" must be an http or https URL without credentials' });
	}

	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new InvalidPayloadError({ reason: '"url" must be an http or https URL without credentials' });
	}

	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

async function get(base: string, path: string, token: string): Promise<unknown> {
	const axios = await getAxios();
	let res: AxiosResponse;

	try {
		res = await axios.get(`${base}${path}`, {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
			timeout: SOURCE_TIMEOUT,
			maxRedirects: 0,
			maxContentLength: SOURCE_MAX_BYTES,
			maxBodyLength: SOURCE_MAX_BYTES,
			responseType: 'json',
			validateStatus: () => true,
		});
	} catch (error) {
		// Never rethrow or log the axios error: it carries the request config (URL, Authorization header).
		const message = error instanceof Error ? error.message : '';
		const code = (error as { code?: string } | null)?.code;

		if (message.includes('resolves to a denied IP address')) {
			throw new InvalidPayloadError({ reason: 'The source address is not allowed' });
		}

		if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') throw unavailable('The source timed out');
		if (code === 'ERR_BAD_RESPONSE' || message.includes('maxContentLength')) {
			throw unavailable('The source returned an unexpected response');
		}

		throw unavailable('The source could not be reached');
	}

	if (res.status >= 300 && res.status < 400) throw unavailable('The source redirected the request');
	if (res.status === 401) throw new InvalidPayloadError({ reason: 'The source rejected the token' });
	if (res.status === 403) throw new InvalidPayloadError({ reason: 'The source token does not belong to an admin' });

	if (res.status === 404 && path === '/backoffice/sync') {
		throw new InvalidPayloadError({ reason: 'The source does not support environment sync' });
	}

	if (res.status !== 200 || typeof res.data !== 'object' || res.data === null) {
		throw unavailable('The source returned an unexpected response');
	}

	return (res.data as { data?: unknown }).data;
}

const infoSchema = Joi.object({
	backoffice: Joi.string().required(),
	directus: Joi.string().required(),
	vendor: Joi.string().required(),
	migrations: Joi.object({
		directus: Joi.array().items(Joi.string()).required(),
		backoffice: Joi.array().items(Joi.string()).required(),
	})
		.unknown(true)
		.required(),
}).unknown(true);

function shaped<T>(schema: Joi.Schema, value: unknown): T {
	const { error, value: valid } = schema.validate(value);
	if (error) throw unavailable('The source returned an unexpected response');
	return valid as T;
}

export async function fetchInfo(base: string, token: string): Promise<SyncInfo> {
	const info = shaped<SyncInfo>(infoSchema, await get(base, '/backoffice/sync', token));

	return {
		backoffice: info.backoffice,
		directus: info.directus,
		vendor: info.vendor,
		migrations: { directus: info.migrations.directus, backoffice: info.migrations.backoffice },
	};
}

const rows = Joi.array().items(Joi.object().unknown(true));

const stateSchema = Joi.object({
	schema: Joi.object({
		collections: rows.required(),
		fields: rows.required(),
		relations: rows.required(),
	}).unknown(true),
	flows: rows,
	access: Joi.object({
		roles: rows.required(),
		policies: rows.required(),
		links: rows.required(),
		permissions: rows.required(),
		bo_permissions: rows.required(),
	}),
	settings: Joi.object().unknown(true).allow(null),
	translations: rows,
	presets: rows,
	dashboards: rows,
	indexes: rows,
	folders: rows,
	extensions: Joi.array().items(
		Joi.object({
			id: Joi.string(),
			name: Joi.string().required(),
			bundle: Joi.string().allow(null).required(),
			enabled: Joi.boolean().required(),
		}),
	),
}).unknown(true);

/** Keeps only the columns the target has for the table (FR-006: nothing unknown is ever written). */
function pick(row: Row, columns: string[]): Row {
	return Object.fromEntries(Object.entries(row).filter(([column]) => columns.includes(column)));
}

/** The source state restricted to the groups asked for and to the tables and columns known at the target. */
export function filterState(state: SyncState, groups: readonly GroupKey[], schema: SchemaOverview): SyncState {
	const out: SyncState = {};
	const kind = (name: string) => TABLE_KINDS.find((k) => k.kind === name)!;

	const table = (name: string, list: Row[] | undefined): Row[] => {
		const k = kind(name);
		const columns = columnsOf(schema, k.table);
		const nestedColumns = k.nested ? columnsOf(schema, k.nested.table) : [];

		return (list ?? []).map((row) => {
			const picked = pick(row, columns);
			if (k.nested && Array.isArray(row[k.nested.name])) {
				picked[k.nested.name] = (row[k.nested.name] as Row[]).map((child) => pick(child, nestedColumns));
			}

			return picked;
		});
	};

	for (const group of groups) {
		if (!GROUP_KEYS.includes(group)) continue;

		if (group === 'schema' && state.schema) out.schema = state.schema;
		if (group === 'flows') out.flows = table('flow', state.flows);
		if (group === 'translations') out.translations = table('translation', state.translations);
		if (group === 'presets') out.presets = table('preset', state.presets);
		if (group === 'dashboards') out.dashboards = table('dashboard', state.dashboards);
		if (group === 'indexes') out.indexes = table('index', state.indexes);
		if (group === 'folders') out.folders = table('folder', state.folders);
		if (group === 'extensions') out.extensions = state.extensions ?? [];

		if (group === 'settings') {
			out.settings = state.settings ? pick(state.settings, columnsOf(schema, 'directus_settings')) : null;
		}

		if (group === 'access') {
			out.access = {
				roles: table('role', state.access?.roles),
				policies: table('policy', state.access?.policies),
				links: table('link', state.access?.links),
				permissions: table('permission', state.access?.permissions),
				bo_permissions: table('bo_permission', state.access?.bo_permissions),
			};
		}
	}

	return out;
}

export async function fetchState(
	base: string,
	token: string,
	groups: readonly GroupKey[],
	schema: SchemaOverview,
): Promise<SyncState> {
	const data = shaped<{ state: SyncState }>(
		Joi.object({ state: stateSchema.required() }).unknown(true),
		await get(base, `/backoffice/sync/state?groups=${groups.join(',')}`, token),
	);

	return filterState(data.state, groups, schema);
}
