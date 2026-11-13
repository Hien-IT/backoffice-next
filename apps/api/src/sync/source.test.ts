// Backoffice (spec 032, contracts/tests.md §1, FR-004, FR-006): calls to the source and how their failures read.
import type { SchemaOverview } from '@backoffice/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchInfo, fetchState, filterState, normalizeUrl, SOURCE_MAX_BYTES, SOURCE_TIMEOUT } from './source.js';

const get = vi.hoisted(() => vi.fn());
vi.mock('../request/index.js', () => ({ getAxios: async () => ({ get }) }));

const TOKEN = 'source-token-secret';
const info = {
	backoffice: '1.0.0',
	directus: '11.17.4',
	vendor: 'postgres',
	migrations: { directus: ['a'], backoffice: [] },
};
const answer = (status: number, data: unknown) => get.mockResolvedValueOnce({ status, data });

afterEach(() => vi.clearAllMocks());

/** The error never carries the token or the source's host. */
async function failure(promise: Promise<unknown>) {
	const error = (await promise.catch((e) => e)) as Error & { status?: number; extensions?: Record<string, unknown> };
	expect(error).toBeInstanceOf(Error);
	expect(
		JSON.stringify({ m: error.message, e: error.extensions, c: (error as { cause?: unknown }).cause ?? null }),
	).not.toMatch(/source-token-secret|source\.example/);
	return error;
}

describe('normalizeUrl', () => {
	test('keeps a sub path, drops the trailing slash; refuses other protocols and credentials', () => {
		expect(normalizeUrl('https://source.example/api/')).toBe('https://source.example/api');
		expect(normalizeUrl('http://10.0.0.5:8055')).toBe('http://10.0.0.5:8055');
		expect(() => normalizeUrl('ftp://source.example')).toThrow(
			'"url" must be an http or https URL without credentials',
		);
		expect(() => normalizeUrl('https://user:pass@source.example')).toThrow('without credentials');
		expect(() => normalizeUrl('not a url')).toThrow('without credentials');
	});
});

describe('fetchInfo', () => {
	test('sends the token in the Authorization header only, no redirect, a timeout and a size cap', async () => {
		answer(200, { data: { ...info, extra: true } });
		await expect(fetchInfo('https://source.example', TOKEN)).resolves.toEqual(info);

		expect(get).toHaveBeenCalledWith('https://source.example/backoffice/sync', {
			headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
			timeout: SOURCE_TIMEOUT,
			maxRedirects: 0,
			maxContentLength: SOURCE_MAX_BYTES,
			maxBodyLength: SOURCE_MAX_BYTES,
			responseType: 'json',
			validateStatus: expect.any(Function),
		});
	});

	test.each([
		[401, 400, 'The source rejected the token'],
		[403, 400, 'The source token does not belong to an admin'],
		[404, 400, 'The source does not support environment sync'],
		[301, 503, 'The source redirected the request'],
		[302, 503, 'The source redirected the request'],
		[500, 503, 'The source returned an unexpected response'],
	])('status %i → %i "%s"', async (status, code, reason) => {
		answer(status, { errors: [{ message: `echo ${TOKEN}` }] });
		const error = await failure(fetchInfo('https://source.example', TOKEN));
		expect(error.status).toBe(code);
		expect(error.extensions?.['reason']).toBe(reason);
	});

	test('a wrong shape is an unexpected response', async () => {
		answer(200, { data: 'nope' });
		expect((await failure(fetchInfo('https://source.example', TOKEN))).status).toBe(503);
	});

	test.each([
		[
			{ message: 'Requested domain "source.example" resolves to a denied IP address' },
			400,
			'The source address is not allowed',
		],
		[{ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }, 503, 'The source timed out'],
		[
			{ code: 'ERR_BAD_RESPONSE', message: 'maxContentLength size of 104857600 exceeded' },
			503,
			'The source returned an unexpected response',
		],
		[{ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED source.example' }, 503, 'The source could not be reached'],
	])('network error %o', async (thrown, code, reason) => {
		get.mockRejectedValueOnce(
			Object.assign(new Error(thrown.message), thrown, { config: { headers: { Authorization: TOKEN } } }),
		);
		const error = await failure(fetchInfo('https://source.example', TOKEN));
		expect(error.status).toBe(code);
		expect(error.extensions?.['reason']).toBe(reason);
	});
});

describe('fetchState and filterState', () => {
	const schema = {
		collections: {
			directus_folders: {
				primary: 'id',
				fields: {
					id: { field: 'id', type: 'uuid', special: [] },
					name: { field: 'name', type: 'string', special: [] },
				},
			},
		},
		relations: [],
	} as unknown as SchemaOverview;

	test('asks for the groups and keeps only the tables and columns the target knows (FR-006)', async () => {
		answer(200, { data: { info, state: { folders: [{ id: 'a', name: 'A', evil: 'x' }], unknown_group: [{}] } } });

		const state = await fetchState('https://source.example', TOKEN, ['folders'], schema);
		expect(get.mock.calls[0]![0]).toBe('https://source.example/backoffice/sync/state?groups=folders');
		expect(state).toEqual({ folders: [{ id: 'a', name: 'A' }] });
	});

	test('a group that was not asked for is dropped', () => {
		expect(filterState({ folders: [{ id: 'a' }], translations: [{ id: 't' }] }, ['folders'], schema)).toEqual({
			folders: [{ id: 'a' }],
		});
	});

	test('a state that is not an object of row arrays is an unexpected response', async () => {
		answer(200, { data: { info, state: { folders: 'nope' } } });
		expect((await failure(fetchState('https://source.example', TOKEN, ['folders'], schema))).status).toBe(503);
	});
});
