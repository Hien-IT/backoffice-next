// Feature 004, SC-001 (T059): the reduced permission matrix for MySQL and SQLite (eachChoice() of matrix.ts: every
// value of every fixture dimension once, read and update on directus_users), with the harness of the full matrix.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { cleanup } from './fixtures.js';
import {
	buildGroup,
	type CellFailure,
	cleanupMatrix,
	makeTargets,
	readCells,
	setupMatrixSchema,
	teardownMatrixSchema,
	writeCells,
} from './matrix-harness.js';
import { eachChoice, groups } from './matrix.js';

let ref: number;

beforeAll(async () => {
	ref = await setupMatrixSchema();
}, 120_000);

afterAll(async () => {
	await cleanupMatrix();
	await cleanup();
	await teardownMatrixSchema();
	await closeHostDb();
}, 300_000);

const byKey = new Map(groups().map((g) => [`${g.accountability}|${g.permission}|${g.ip}`, g]));

describe('reduced permission matrix', () => {
	const choices = [...new Set(eachChoice().map((c) => `${c.accountability}|${c.permission}|${c.ip}`))];

	it.each(choices)(
		'group %s',
		async (key) => {
			const group = byKey.get(key)!;
			const cells = eachChoice().filter((c) => `${c.accountability}|${c.permission}|${c.ip}` === key);
			const fixture = await buildGroup(group, ref);
			const failures: CellFailure[] = [];

			try {
				const shared = await makeTargets('directus', `parity-matrix-r${group.index}-${Date.now().toString(36)}`, ref);
				failures.push(
					...(await readCells(
						cells.filter((c) => c.action === 'read'),
						fixture.headers,
						shared,
					)),
				);
				failures.push(
					...(await writeCells(
						group,
						cells.filter((c) => c.action === 'update'),
						fixture.headers,
						ref,
					)),
				);
			} finally {
				await fixture.cleanup();
				await cleanupMatrix();
			}

			expect(failures.map((f) => `${f.cell}\n${f.detail}`).join('\n\n')).toBe('');
		},
		180_000,
	);
});
