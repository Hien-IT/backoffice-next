// Unit tests of the permission matrix generator (tasks T008), no Docker.
import { describe, expect, test } from 'vitest';
import {
	ACCOUNTABILITIES,
	ACTIONS,
	allCells,
	cellId,
	COLLECTIONS,
	eachChoice,
	groups,
	IP_ACCESS,
	parseShard,
	PERMISSION_CONFIGS,
	REQUESTS,
	shardGroups,
} from './permissions/matrix.js';

describe('full product (spec FR-101)', () => {
	test('has 10 × 13 × 5 × 5 × 6 = 19,500 distinct cells in 650 fixture groups of 30', () => {
		const cells = allCells();
		expect(cells).toHaveLength(19_500);
		expect(new Set(cells.map(cellId)).size).toBe(19_500);
		expect(groups()).toHaveLength(650);
		expect(groups().every((group) => group.cells.length === 30)).toBe(true);
	});

	test('every action has a fixed request set', () => {
		expect(Object.keys(REQUESTS).sort()).toEqual([...ACTIONS].sort());
		expect(REQUESTS.share).toEqual([{ method: 'GET', path: '/permissions/me/{collection}/{pk}' }]);
	});
});

describe('shards', () => {
	test.each([1, 3, 7, 20])('%i shards cover every group exactly once', (count) => {
		const seen = Array.from({ length: count }, (_, i) => shardGroups({ index: i + 1, count })).flat();
		expect(seen.map((group) => group.index).sort((a, b) => a - b)).toEqual(groups().map((group) => group.index));
	});

	test('parses <i>/<n> and rejects anything else', () => {
		expect(parseShard('2/5')).toEqual({ index: 2, count: 5 });
		expect(parseShard(undefined)).toEqual({ index: 1, count: 1 });
		expect(parseShard('')).toEqual({ index: 1, count: 1 });
		expect(() => parseShard('0/5')).toThrow();
		expect(() => parseShard('6/5')).toThrow();
		expect(() => parseShard('x')).toThrow();
	});
});

describe('reduced matrix (spec SC-001)', () => {
	const cells = eachChoice();

	test('every value of the fixture dimensions appears at least once', () => {
		expect(new Set(cells.map((c) => c.accountability))).toEqual(new Set(ACCOUNTABILITIES));
		expect(new Set(cells.map((c) => c.permission))).toEqual(new Set(PERMISSION_CONFIGS));
		expect(new Set(cells.map((c) => c.ip))).toEqual(new Set(IP_ACCESS));
	});

	test('only read and update on directus_users', () => {
		expect(new Set(cells.map((c) => c.action))).toEqual(new Set(['read', 'update']));
		expect(new Set(cells.map((c) => c.collection))).toEqual(new Set([COLLECTIONS[0]]));
	});
});
