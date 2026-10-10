// FR-101: every accepted difference exists in the table of its spec, carries the right removal feature, and a
// temporary one fails once the removing feature's spec is Done. Run by the CI job guard-differences.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { type AcceptedDifference, acceptedDifferences } from '../accepted-differences.js';
import { readSpecDifferences } from './spec-differences.js';

export function checkAcceptedDifferences(entries: AcceptedDifference[], specsDir?: string): string[] {
	const problems: string[] = [];

	for (const entry of entries) {
		const spec = readSpecDifferences(entry.feature, specsDir);

		if (!spec) {
			problems.push(`${entry.id}: spec of feature ${entry.feature} not found`);
			continue;
		}

		if (!spec.codes.has(entry.id)) {
			problems.push(`${entry.id}: not in the "Khác biệt so với Directus" table of feature ${entry.feature}`);
			continue;
		}

		const removeAt = spec.codes.get(entry.id) ?? '';

		if ((entry.removeAt ?? '') !== removeAt) {
			problems.push(`${entry.id}: removeAt is "${entry.removeAt ?? ''}" but the spec says "${removeAt}"`);
		}

		if (entry.removeAt) {
			const remover = readSpecDifferences(entry.removeAt, specsDir);

			if (remover?.status === 'Done') {
				problems.push(
					`${entry.id}: feature ${entry.removeAt} is Done, remove this temporary difference and keep its parity test`,
				);
			}
		}
	}

	return problems;
}

test('the accepted differences match the spec tables (FR-101)', () => {
	expect(checkAcceptedDifferences(acceptedDifferences)).toEqual([]);
});

test('every code of the 001 table is listed (no forgotten difference)', () => {
	// A temporary difference leaves the list when the feature that removes it is Done (feature 002: D-20, D-22).
	const removed = (code: string) => {
		const removeAt = readSpecDifferences('001')!.codes.get(code);
		return removeAt !== undefined && removeAt !== '' && readSpecDifferences(removeAt)?.status === 'Done';
	};

	const codes = [...readSpecDifferences('001')!.codes.keys()].filter((c) => c !== 'D-09' && !removed(c));
	const listed = new Set(acceptedDifferences.map((d) => d.id));
	expect(codes.filter((c) => !listed.has(c))).toEqual([]);
});

describe('fails on purpose with fake specs', () => {
	function specs(files: Record<string, string>): string {
		const dir = mkdtempSync(join(tmpdir(), 'specs-'));

		for (const [feature, content] of Object.entries(files)) {
			mkdirSync(join(dir, feature), { recursive: true });
			writeFileSync(join(dir, feature, 'spec.md'), content);
		}

		return dir;
	}

	const table = (rows: string) => `**Status**: Draft\n\n| Mã | Hạng mục | Gỡ khi |\n|----|----|----|\n${rows}\n`;
	const entry = (id: string, removeAt?: string): AcceptedDifference => ({
		id,
		feature: '001',
		kind: 'doc',
		reason: 'x',
		...(removeAt ? { removeAt } : {}),
	});

	test('unknown code, wrong removeAt, missing spec', () => {
		const dir = specs({ '001-x': table('| D-01 | a | — |\n| D-02 | b | 003 |') });

		expect(
			checkAcceptedDifferences(
				[entry('D-01'), entry('D-02', '004'), entry('D-99'), { ...entry('D-01'), feature: '777' }],
				dir,
			),
		).toEqual([
			'D-02: removeAt is "004" but the spec says "003"',
			'D-99: not in the "Khác biệt so với Directus" table of feature 001',
			'D-01: spec of feature 777 not found',
		]);
	});

	test('a temporary difference still listed when its feature is Done', () => {
		const dir = specs({ '001-x': table('| D-02 | b | 003 |'), '003-auth': '**Status**: Done\n' });
		expect(checkAcceptedDifferences([entry('D-02', '003')], dir)).toEqual([
			'D-02: feature 003 is Done, remove this temporary difference and keep its parity test',
		]);
	});

	test('a code with the same id in another spec does not count', () => {
		const dir = specs({ '001-x': table('| D-01 | a | — |'), '002-y': table('| D-02 | b | — |') });
		expect(checkAcceptedDifferences([entry('D-02')], dir)).toEqual([
			'D-02: not in the "Khác biệt so với Directus" table of feature 001',
		]);
	});
});
