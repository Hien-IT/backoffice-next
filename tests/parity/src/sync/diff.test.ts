// Spec 032 US1 (FR-007..FR-015, FR-029, contracts/tests.md §2b, profile sync): the comparison of the main Backoffice
// (source) with backoffice-api-sync (target) shows the four states per group and writes nothing on either side.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { diff, rowOf, source, TARGET, TARGET_2_IN_DOCKER, TARGET_TOKEN, target } from './helpers.js';
import { cleanup, newSeed, seed } from './seed.js';

const s = newSeed();
const ALL = [
	'schema',
	'flows',
	'access',
	'settings',
	'translations',
	'presets',
	'dashboards',
	'indexes',
	'folders',
	'extensions',
];

describe.skipIf(!TARGET)('profile sync: diff', () => {
	beforeAll(async () => {
		await seed(s);
	}, 120_000);

	afterAll(async () => {
		await cleanup(s);
	}, 120_000);

	test('every group compares; the seeded rows have the expected state, dependencies and labels', async () => {
		const answer = await diff(ALL);
		expect(answer.status, JSON.stringify(answer.body)).toBe(200);

		const { hash, groups, rows, source: info } = answer.body.data;
		expect(hash).toMatch(/^[0-9a-f]{40}$/);
		expect(groups).toEqual(ALL);
		expect(info.directus).toBe('11.17.4');

		expect(rowOf(rows, `schema/collection:${s.collection}`)).toMatchObject({ state: 'source_only', selectable: true });
		expect(rowOf(rows, `flows/flow:${s.flow}`)).toMatchObject({ state: 'source_only', impact: { active: true } });
		expect(rowOf(rows, `flows/flow:${s.flow}`).source.operations).toHaveLength(1);
		expect(rowOf(rows, `flows/flow:${s.targetFlow}`)).toMatchObject({ state: 'target_only', selectable: true });
		expect(rowOf(rows, `access/policy:${s.policy}`)).toMatchObject({ state: 'changed' });
		expect(rowOf(rows, `access/policy:${s.policy}`).changes.map((c: any) => c.path)).toContain('name');
		expect(rowOf(rows, `access/permission:${s.policy}:${s.collection}:read`)).toMatchObject({
			state: 'source_only',
			depends: expect.arrayContaining([`access/policy:${s.policy}`, `schema/collection:${s.collection}`]),
		});
		expect(rowOf(rows, `access/role:${s.role}`)).toMatchObject({ state: 'source_only' });
		expect(rowOf(rows, `access/link:${s.link}`)).toMatchObject({
			state: 'source_only',
			depends: expect.arrayContaining([`access/role:${s.role}`, `access/policy:${s.policy}`]),
		});
		expect(rowOf(rows, `translations/translation:en-US:${s.translationKey}`)).toMatchObject({ state: 'source_only' });
		expect(rowOf(rows, `presets/preset:${s.collection}:${s.bookmark}`)).toMatchObject({ state: 'source_only' });
		expect(rowOf(rows, `dashboards/dashboard:${s.dashboard}`).source.panels).toHaveLength(1);
		expect(rowOf(rows, `folders/folder:${s.folder}`)).toMatchObject({ state: 'source_only' });
		expect(rowOf(rows, 'settings/field:ai_openai_api_key')).toMatchObject({
			selectable: false,
			reason: 'sync_value_hidden',
		});

		// A same row carries no values (contracts/api.md).
		const sameRow = rows.find((r: any) => r.state === 'same');
		if (sameRow) expect(sameRow).not.toHaveProperty('source');
	}, 120_000);

	test('FR-013: the state served by the source never carries a masked value', async () => {
		const state = await source('GET', '/backoffice/sync/state');
		expect(JSON.stringify(state)).not.toContain('**********');
		expect(state.data.state.settings).not.toHaveProperty('ai_openai_api_key');
	});

	test('FR-015: a comparison writes nothing on either side', async () => {
		const read = async () => ({
			source: (await source('GET', '/backoffice/sync/state?groups=flows,access,folders,translations')).data.state,
			target: (await target('GET', '/backoffice/sync/state?groups=flows,access,folders,translations')).body.data.state,
		});

		const before = await read();
		expect((await diff(ALL)).status).toBe(200);
		expect(await read()).toEqual(before);
	}, 120_000);

	test('analyze E3: node 2 on the same database as the source of node 1 gives only same rows', async () => {
		const answer = await target('POST', '/backoffice/sync/diff', {
			url: TARGET_2_IN_DOCKER,
			token: TARGET_TOKEN,
			groups: ['flows', 'access', 'settings', 'translations', 'presets', 'dashboards', 'folders', 'extensions'],
		});

		expect(answer.status, JSON.stringify(answer.body)).toBe(200);
		expect(answer.body.data.rows.filter((r: any) => r.state !== 'same')).toEqual([]);
	}, 120_000);
});
