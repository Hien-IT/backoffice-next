import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DIRECTUS_MIGRATIONS } from './directus-11.17.4.js';

// Spec 021 FR-025: the 101 system migrations are verbatim ports. A port equals its Directus file after exactly two
// changes: a first line naming the source, and the import specifiers below (the imported names never change).
const SOURCE_DIR = new URL('../../../../../directus/api/src/database/migrations/', import.meta.url);
const PORT_DIR = new URL('./', import.meta.url);
const MIGRATION_FILE = /^[0-9]+[A-Z]-[^.]+\.ts$/;

const SPECIFIERS: [RegExp, string][] = [
	[/'@directus\/(utils|utils\/node|schema|env|constants|types)'/g, "'@backoffice/$1'"],
	[/'\.\.\/\.\.\/utils\/get-schema\.js'/g, "'../../schema/get-database-schema.js'"],
	[/'\.\.\/\.\.\/services\/fields\.js'/g, "'../../services/fields.service.js'"],
	[/'\.\.\/\.\.\/services\/settings\.js'/g, "'../../services/settings.service.js'"],
];

/** Applies the specifier table to import lines only. */
function mapImports(source: string): string {
	return source
		.split('\n')
		.map((line) =>
			line.startsWith('import ')
				? SPECIFIERS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), line)
				: line,
		)
		.join('\n');
}

const sourceFiles = readdirSync(SOURCE_DIR)
	.filter((f) => MIGRATION_FILE.test(f))
	.sort();

test('the ported folder has exactly the 101 Directus 11.17.4 migrations', () => {
	const ported = readdirSync(PORT_DIR)
		.filter((f) => MIGRATION_FILE.test(f))
		.sort();

	expect(sourceFiles).toHaveLength(101);
	expect(ported).toEqual(sourceFiles);
	expect(ported.map((f) => f.split('-')[0])).toEqual([...DIRECTUS_MIGRATIONS]);
});

test.each(sourceFiles)('%s is a verbatim port', (file) => {
	const [header, ...rest] = readFileSync(new URL(file, PORT_DIR), 'utf8').split('\n');
	const source = readFileSync(new URL(file, SOURCE_DIR), 'utf8');

	expect(header).toBe(`// Ported from directus/api/src/database/migrations/${file}`);
	expect(rest.join('\n')).toBe(mapImports(source));
});
