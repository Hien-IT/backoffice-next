// Feature 014 US7 (T087, contracts/tests.md §4): `normalize` of helpers/payload.ts, without a browser.
import { expect, test } from '@playwright/test';
import { DATA_PREFIX } from './config.js';
import { calls, normalize, RUN_TAG } from './payload.js';

test('send order kept, object keys sorted, arrays kept in order', () => {
	const writes = [
		{ method: 'POST', path: '/presets', body: { b: 1, a: { d: [3, 1], c: 2 } } },
		{ method: 'PATCH', path: '/presets/12', body: null },
	];
	const out = normalize({ writes, keys: [] });

	expect(calls(out)).toEqual(['POST /presets', 'PATCH /presets/<id>']);
	expect(JSON.stringify(out[0]!.body)).toBe('{"a":{"c":2,"d":[3,1]},"b":1}');
});

test('run tags, DATA_PREFIX, uuids and ISO times are replaced', () => {
	const uuid = '1002b7f4-1cee-4237-a361-b9f77b1abf49';
	const [write] = normalize({
		writes: [
			{
				method: 'PATCH',
				path: `/versions/${uuid}`,
				body: {
					title: `${RUN_TAG.dir} item`,
					other: `${DATA_PREFIX} x`,
					user: uuid,
					comment: `Hello @${uuid}`,
					date: '2026-10-15T09:00:00.000Z',
					local: '2026-10-15T09:00:00',
				},
			},
		],
		keys: [],
	});

	expect(write).toEqual({
		method: 'PATCH',
		path: '/versions/<uuid>',
		body: {
			comment: 'Hello @<uuid>',
			date: '<ts>',
			local: '<ts>',
			other: '<prefix> x',
			title: '<prefix> item',
			user: '<uuid>',
		},
	});
	expect(normalize({ writes: [{ method: 'POST', path: '/x', body: `${RUN_TAG.bo} item` }], keys: [] })[0]!.body).toBe(
		'<prefix> item',
	);
});

test('created keys and set-up ids become numbered markers in paths, values and strings', () => {
	const writes = [
		{ method: 'POST', path: '/graphql', body: { query: 'bo_content_by_id (id: "93") { id }' } },
		{ method: 'DELETE', path: '/items/bo_content', body: [93, 94] },
		{ method: 'PATCH', path: '/items/bo_content/94', body: { item: '7', page: 1, sort: 930 } },
	];
	const out = normalize({ writes, keys: [93, 94] }, [7]);

	expect(out).toEqual([
		{ method: 'POST', path: '/graphql', body: { query: 'bo_content_by_id (id: "<id2>") { id }' } },
		{ method: 'DELETE', path: '/items/bo_content', body: ['<id2>', '<id3>'] },
		{ method: 'PATCH', path: '/items/bo_content/<id3>', body: { item: '<id1>', page: 1, sort: 930 } },
	]);
});

test('block editor time and block ids, version mainHash, query strings', () => {
	const [write] = normalize({
		writes: [
			{
				method: 'POST',
				path: '/versions/abc/promote?x=2026-10-15T09:00:00Z',
				body: {
					mainHash: 'fd06984bb9fa763fb93c7d7acd1c763db5eee352',
					body: {
						time: 1760000000000,
						blocks: [{ id: 'aB3xYz', type: 'paragraph', data: { id: 'kept', text: 'hi' } }],
					},
				},
			},
		],
		keys: [],
	});

	expect(write).toEqual({
		method: 'POST',
		path: '/versions/abc/promote?x=<ts>',
		body: {
			body: { blocks: [{ data: { id: 'kept', text: 'hi' }, id: '<block-id>', type: 'paragraph' }], time: '<time>' },
			mainHash: '<hash>',
		},
	});
});
