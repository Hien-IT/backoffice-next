// Ported from directus/app/src/modules/settings/routes/flows/triggers.test.ts
import { describe, expect, test, vi } from 'vitest';
import { getTriggers } from './triggers.ts';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../api/sdk.ts', () => ({
	getApiUrl: () => 'http://localhost:8055/',
}));

describe('webhook trigger options', () => {
	const { triggers } = getTriggers();
	const webhook = triggers.find((t) => t.id === 'webhook')!;
	const getOptions = webhook.options as (opts: Record<string, any>) => Record<string, any>[];

	test('cacheQueryParams field should be visible when cacheEnabled is true (default)', () => {
		const options = getOptions({ method: 'GET', cacheEnabled: true });
		const cacheQueryParams = options.find((o) => o['field'] === 'cacheQueryParams');

		expect(cacheQueryParams).toBeDefined();
		expect(cacheQueryParams!['meta']['hidden']).toBe(false);
	});

	test('cacheQueryParams field should be visible when cacheEnabled is undefined (default)', () => {
		const options = getOptions({ method: 'GET', cacheEnabled: undefined });
		const cacheQueryParams = options.find((o) => o['field'] === 'cacheQueryParams');

		expect(cacheQueryParams).toBeDefined();
		expect(cacheQueryParams!['meta']['hidden']).toBe(false);
	});

	test('cacheQueryParams field should be hidden when cacheEnabled is false', () => {
		const options = getOptions({ method: 'GET', cacheEnabled: false });
		const cacheQueryParams = options.find((o) => o['field'] === 'cacheQueryParams');

		expect(cacheQueryParams).toBeDefined();
		expect(cacheQueryParams!['meta']['hidden']).toBe(true);
	});

	test('cacheQueryParams field should be hidden for non-GET methods', () => {
		const options = getOptions({ method: 'POST', cacheEnabled: true });
		const cacheQueryParams = options.find((o) => o['field'] === 'cacheQueryParams');

		expect(cacheQueryParams).toBeDefined();
		expect(cacheQueryParams!['meta']['hidden']).toBe(true);
	});
});

// Backoffice (spec 017 FR-012, CHK013): the webhook URL is built on the API base URL.
describe('webhook trigger overview', () => {
	test('shows the method and the copyable trigger URL', () => {
		const { triggers } = getTriggers();
		const webhook = triggers.find((t) => t.id === 'webhook')!;

		expect(webhook.overview({ method: 'POST' }, { flow: { id: 'f-1' } } as never)).toEqual([
			{ label: 'method', text: 'POST' },
			{ label: 'url', text: 'http://localhost:8055/flows/trigger/f-1', copyable: true },
		]);
	});
});
