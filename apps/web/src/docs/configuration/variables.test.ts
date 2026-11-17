// Spec 033 T037 (FR-030..FR-033, FR-051, SC-005; US5): every variable the API reads has exactly one row, and no row
// describes a variable the API does not read.
import { describe, expect, test } from 'vitest';
import { configGroups } from './groups.ts';
import supported from './supported.generated.json';
import { configTablesEn } from './variables.en.ts';
import { configTables } from './variables.ts';

const rows = Object.entries(configTables).flatMap(([group, tables]) =>
	tables.flatMap((table) => table.rows.map((row) => ({ ...row, group }))),
);
const patterns = supported.variables.map((variable) => variable.pattern);

describe('configuration variables', () => {
	test('every variable the API reads has a row', () => {
		const described = new Set(rows.map((row) => row.pattern));

		expect(patterns.filter((pattern) => !described.has(pattern))).toEqual([]);
	});

	test('no row for a variable the API does not read', () => {
		expect(rows.map((row) => row.pattern).filter((pattern) => !patterns.includes(pattern))).toEqual([]);
	});

	test('a variable has one row, in one group', () => {
		const seen = new Map<string, string>();
		const twice: string[] = [];

		for (const row of rows) {
			if (seen.has(row.pattern)) twice.push(`${row.pattern} (${seen.get(row.pattern)}, ${row.group})`);
			seen.set(row.pattern, row.group);
		}

		expect(twice).toEqual([]);
	});

	test('a plain variable is shown under its own name, a family under a readable one', () => {
		for (const variable of supported.variables) {
			const row = rows.find((candidate) => candidate.pattern === variable.pattern)!;

			if (variable.exact) expect(row.name).toBe(variable.pattern);
			else expect(row.name).toMatch(/^[A-Z0-9_]*(\*|<[A-Z]+>)[A-Z0-9_*]*$/);
		}
	});

	test('every description says what the variable does and ends a sentence', () => {
		for (const row of rows) {
			expect(row.description.length, row.name).toBeGreaterThan(20);
			expect(row.description, row.name).toMatch(/[.)`]$/);
		}
	});

	test('every group has a page and at least one table; table titles are unique in a page', () => {
		expect(Object.keys(configTables).sort()).toEqual(configGroups.map((group) => group.id).sort());

		for (const [group, tables] of Object.entries(configTables)) {
			expect(tables.length, group).toBeGreaterThan(0);
			const titles = tables.map((table) => table.title);
			expect(new Set(titles).size, group).toBe(titles.length);
		}
	});

	test('no secret value: descriptions never show a real key or password', () => {
		for (const row of rows)
			expect(`${row.description} ${row.note ?? ''}`, row.name).not.toMatch(/(?:sk|pk)_[a-z]+_|-----BEGIN|password=\S/i);
	});

	// Amendment 2026-11-18: the English tables have the same rows; only the texts differ.
	test('variables.en.ts has the same groups, tables and rows in the same order', () => {
		const shape = (all: typeof configTables) =>
			Object.entries(all).map(([group, tables]) => [
				group,
				tables.map((table) => [
					!!table.title,
					!!table.note,
					table.rows.map((row) => [row.name, row.pattern, !!row.note]),
				]),
			]);

		expect(shape(configTablesEn)).toEqual(shape(configTables));
	});
});
