// Feature 009 (research R10): the comparable form of run log rows needs no Docker.
import { expect, test } from 'vitest';
import { comparable, stableHeaders, withoutD097 } from './helpers.js';

const rows = (data: unknown) => ({
	activity: [{ id: 41, action: 'run', item: 'f-1', timestamp: '2026-10-14T00:00:00Z', user: null }],
	revisions: [
		{
			id: 90,
			activity: 41,
			collection: 'directus_flows',
			item: 'f-1',
			data: JSON.stringify(data),
			delta: null,
			parent: null,
			version: null,
		},
	],
	versions: [],
	comments: [],
	notifications: [],
	versionKeys: {},
});

test('run revisions: flow and operation ids as placeholders, no $env, request headers reduced to content-type', () => {
	const data = {
		steps: [{ operation: 'o-1', key: 'req', status: 'resolve', options: {} }],
		data: {
			$env: { PUBLIC_URL: 'x' },
			$trigger: { body: {} },
			req: { status: 200, statusText: 'OK', headers: { 'content-type': 'text/html', date: 'now' }, data: 'pong' },
		},
	};

	const result = comparable(rows(data), { flow: 'f-1', req: 'o-1' });

	expect(result.activity).toEqual([{ action: 'run', item: '<flow>', timestamp: '<time>', user: null }]);
	expect(result.revisions[0].activity).toBe(0);
	expect(result.revisions[0].data.steps[0].operation).toBe('<req>');
	expect(result.revisions[0].data.data).not.toHaveProperty('$env');
	expect(result.revisions[0].data.data.req.headers).toEqual({ 'content-type': 'text/html' });
});

test('stableHeaders leaves other values alone', () => {
	expect(stableHeaders({ status: 1 })).toEqual({ status: 1 });
	expect(stableHeaders(['a'])).toEqual(['a']);
	expect(stableHeaders(null)).toBeNull();
});

test('withoutD097 drops only the temporary /flows difference', () => {
	expect(withoutD097.some((d) => d.id === 'D-09.7')).toBe(false);
	expect(withoutD097.some((d) => d.id === 'D-09.8')).toBe(true);
});
