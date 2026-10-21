import { readdirSync, readFileSync } from 'node:fs';
import { createInspector } from '@backoffice/schema';
import yaml from 'js-yaml';
import knex, { type Knex } from 'knex';
import { afterEach, beforeEach, expect, test } from 'vitest';
import runSeed from './run.js';

// Spec 021 FR-011..FR-013. Directus has no unit test for the seeds; this one checks the copies and the runner.
const SOURCE_DIR = new URL('../../../../../directus/api/src/database/seeds/', import.meta.url);
const PORT_DIR = new URL('./', import.meta.url);

const seedFiles = readdirSync(SOURCE_DIR)
	.filter((f) => f.endsWith('.yaml'))
	.sort();

type TableSeed = { table: string; columns: Record<string, { type?: string }> };

let db: Knex;

beforeEach(() => {
	db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
});

afterEach(async () => {
	await db.destroy();
});

test('the 15 Directus 11.17.4 seed files are copied', () => {
	expect(seedFiles).toHaveLength(15);
	expect(
		readdirSync(PORT_DIR)
			.filter((f) => f.endsWith('.yaml'))
			.sort(),
	).toEqual(seedFiles);
});

test.each(seedFiles)('%s is a verbatim copy', (file) => {
	const [header, ...rest] = readFileSync(new URL(file, PORT_DIR), 'utf8').split('\n');

	expect(header).toBe(`# Ported from directus/api/src/database/seeds/${file}`);
	expect(rest.join('\n')).toBe(readFileSync(new URL(file, SOURCE_DIR), 'utf8'));
});

test('creates every seeded table with the columns of its yaml (SQLite)', async () => {
	await runSeed(db);

	const inspector = createInspector(db);

	for (const file of seedFiles) {
		const seed = yaml.load(readFileSync(new URL(file, SOURCE_DIR), 'utf8')) as TableSeed;

		// runSeed stops at the first alias/unknown column of a table, like Directus (the `return` in its loop).
		const expected: string[] = [];

		for (const [name, info] of Object.entries(seed.columns)) {
			if (info.type === 'alias' || info.type === 'unknown') break;
			expected.push(name);
		}

		const columns = (await inspector.columnInfo(seed.table)).map((c) => c.name);
		expect(columns.sort(), seed.table).toEqual(expected.sort());
	}
});

test('refuses a database that already has directus_collections', async () => {
	await db.schema.createTable('directus_collections', (t) => t.string('collection').primary());

	await expect(runSeed(db)).rejects.toThrow('Database is already installed');
});
