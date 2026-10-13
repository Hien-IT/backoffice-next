// Ported from directus/api/src/utils/get-cache-key.test.ts
// Backoffice: the GraphQL cases (feature 011) are left out with their code.
// The version is mocked to 1.2.3 as in Directus, so the expected keys are Directus' own: same hash, same key (FR-010).
import type { Request } from 'express';
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDatabase } from '../database/index.js';
import { getFlowManager } from '../flows.js';
import { fetchPoliciesIpAccess } from '../permissions/modules/fetch-policies-ip-access/fetch-policies-ip-access.js';
import { getCacheKey } from './get-cache-key.js';

vi.mock('../database/index.js');

vi.mock('../permissions/modules/fetch-policies-ip-access/fetch-policies-ip-access.js');

vi.mock('../flows.js', () => ({
	getFlowManager: vi.fn().mockReturnValue({
		getFlow: vi.fn().mockReturnValue(undefined),
	}),
}));

vi.mock('../constants.js', () => ({ DIRECTUS_COMPAT_VERSION: '1.2.3' }));

beforeEach(() => {
	vi.mocked(getDatabase).mockReturnValue({} as Knex);
});

const baseUrl = 'http://localhost';
const restUrl = `${baseUrl}/items/example`;
const flowTriggerUrl = `${baseUrl}/flows/trigger/00000000-0000-0000-0000-000000000001`;
const accountability = { user: '00000000-0000-0000-0000-000000000000' };
const method = 'GET';

const requests = [
	{
		name: 'as unauthenticated request',
		params: { method, originalUrl: restUrl },
		key: '20ada3d7cc37fb7e742d2a723f6f1d7a64686d2e',
	},
	{
		name: 'as authenticated request',
		params: { method, originalUrl: restUrl, accountability },
		key: '79daba5bf38b6b80cb4bf4e2de95d6a8380f7927',
	},
	{
		name: 'a request with a fields query',
		params: { method, originalUrl: restUrl, sanitizedQuery: { fields: ['id', 'name'] } },
		key: 'e1839f7379b39188622e797fdbe2e3e6d477cbdc',
	},
	{
		name: 'a request with a filter query',
		params: { method, originalUrl: restUrl, sanitizedQuery: { filter: { name: { _eq: 'test' } } } },
		key: '0bcc9af5f628db85043133e59226b2de154d7183',
	},
];

const cases = requests.map(({ name, params, key }) => [name, params, key]);

afterEach(() => {
	vi.clearAllMocks();
});

describe('get cache key', async () => {
	test.each(cases)('should create a cache key for %s', async (_, params, key) => {
		expect(await getCacheKey(params as unknown as Request)).toEqual(key);
	});

	test('should create a unique key for each request', async () => {
		const keys = cases.map(async ([, params]) => await getCacheKey(params as unknown as Request));
		const hasDuplicate = keys.some((key) => keys.indexOf(key) !== keys.lastIndexOf(key));

		expect(hasDuplicate).toBeFalsy();
	});

	test('should not create a unique key for flow trigger requests with different custom query params', async () => {
		const reqWithCustomQuery1: any = {
			method,
			originalUrl: `${flowTriggerUrl}?region=us`,
			query: { region: 'us' },
			sanitizedQuery: {},
		};

		const reqWithCustomQuery2: any = {
			method,
			originalUrl: `${flowTriggerUrl}?region=eu`,
			query: { region: 'eu' },
			sanitizedQuery: {},
		};

		const reqWithoutCustomQuery: any = {
			method,
			originalUrl: flowTriggerUrl,
			sanitizedQuery: {},
		};

		expect(await getCacheKey(reqWithCustomQuery1)).toEqual(await getCacheKey(reqWithCustomQuery2));
		expect(await getCacheKey(reqWithCustomQuery1)).toEqual(await getCacheKey(reqWithoutCustomQuery));
	});

	test('should not change cache key when req.query is empty on flow trigger', async () => {
		const reqWithEmptyQuery: any = {
			method,
			originalUrl: flowTriggerUrl,
			query: {},
			sanitizedQuery: {},
		};

		const reqWithoutQuery: any = {
			method,
			originalUrl: flowTriggerUrl,
			sanitizedQuery: {},
		};

		expect(await getCacheKey(reqWithEmptyQuery)).toEqual(await getCacheKey(reqWithoutQuery));
	});

	test('should only include allowed query params when cacheQueryParams is configured', async () => {
		const flowId = '00000000-0000-0000-0000-000000000001';

		vi.mocked(getFlowManager).mockReturnValue({
			getFlow: vi.fn().mockReturnValue({
				options: {
					cacheQueryParams: ['region'],
				},
			}),
		} as any);

		const reqWithAllowed: any = {
			method,
			originalUrl: `${baseUrl}/flows/trigger/${flowId}?region=us&noise=123`,
			query: { region: 'us', noise: '123' },
			sanitizedQuery: {},
		};

		const reqWithDifferentAllowed: any = {
			method,
			originalUrl: `${baseUrl}/flows/trigger/${flowId}?region=eu&noise=456`,
			query: { region: 'eu', noise: '456' },
			sanitizedQuery: {},
		};

		const reqWithSameAllowedDifferentNoise: any = {
			method,
			originalUrl: `${baseUrl}/flows/trigger/${flowId}?region=us&noise=789`,
			query: { region: 'us', noise: '789' },
			sanitizedQuery: {},
		};

		// Different allowed param values should produce different keys
		expect(await getCacheKey(reqWithAllowed)).not.toEqual(await getCacheKey(reqWithDifferentAllowed));

		// Same allowed param, different noise should produce the SAME key (noise is filtered out)
		expect(await getCacheKey(reqWithAllowed)).toEqual(await getCacheKey(reqWithSameAllowedDifferentNoise));

		// Reset mock to default (no allowlist)
		vi.mocked(getFlowManager).mockReturnValue({
			getFlow: vi.fn().mockReturnValue(undefined),
		} as any);
	});

	test('should not include raw query params for standard REST endpoints', async () => {
		const reqWithCustomQuery: any = {
			method,
			originalUrl: `${restUrl}?custom=foo`,
			query: { custom: 'foo' },
			sanitizedQuery: {},
		};

		const reqWithoutCustomQuery: any = {
			method,
			originalUrl: restUrl,
			sanitizedQuery: {},
		};

		expect(await getCacheKey(reqWithCustomQuery)).toEqual(await getCacheKey(reqWithoutCustomQuery));
	});

	test('it should create a unique key for requests which match a policy ip_access filter', async () => {
		const reqWithMatchingIp: any = {
			method,
			originalUrl: restUrl,
			accountability: { ...accountability, ip: '127.0.0.1' },
		};

		const reqWithNotMatchingIp: any = {
			method,
			originalUrl: restUrl,
			accountability: { ...accountability, ip: '127.0.0.2' },
		};

		const reqWithoutIp: any = { method, originalUrl: restUrl, accountability: { ...accountability } };

		vi.mocked(fetchPoliciesIpAccess).mockResolvedValue([['127.0.0.1']]);

		expect(await getCacheKey(reqWithMatchingIp)).not.toEqual(await getCacheKey(reqWithoutIp));
		expect(await getCacheKey(reqWithNotMatchingIp)).toEqual(await getCacheKey(reqWithoutIp));
	});
});
