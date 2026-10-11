// Backoffice: directus/api/src/services/import-export.test.ts has no case for ExportService.transform (it tests the
// import and the CSV headings of exportToFile, feature 010); these cases cover every branch of transform (T023).
import type { SchemaOverview } from '@backoffice/types';
import { describe, expect, test, vi } from 'vitest';
import { ExportService } from './import-export.service.js';

vi.mock('../database/index.js', () => ({ default: vi.fn() }));

const service = new ExportService({ knex: {} as any, schema: {} as SchemaOverview });
const rows = [
	{ id: 1, title: 'a', author: { name: 'Ann' }, tags: [1, 2] },
	{ id: 2, title: 'b, "quoted"', author: null, tags: [] },
];

describe('json', () => {
	test('tab-indented, null without data', () => {
		expect(service.transform(rows.slice(0, 1), 'json')).toBe(JSON.stringify(rows.slice(0, 1), null, '\t'));
		expect(service.transform(undefined as any, 'json')).toBe('null');
	});

	test('header and footer can be left out (batches of exportToFile)', () => {
		expect(service.transform([{ a: 1 }], 'json', { includeHeader: false, includeFooter: false })).toBe(
			'\t{\n\t\t"a": 1\n\t},\n',
		);
	});
});

describe('xml', () => {
	test('root element data, each row in a nested data element (js2xmlparser 5.0.0)', () => {
		const xml = service.transform([{ id: 1, title: 'a' }], 'xml');
		expect(xml).toBe(
			"<?xml version='1.0'?>\n<data>\n    <data>\n        <id>1</id>\n        <title>a</title>\n    </data>\n</data>",
		);
		expect(service.transform([{ id: 1 }], 'xml', { includeHeader: false, includeFooter: false })).toBe(
			'    <data>\n        <id>1</id>\n    </data>\n',
		);
	});
});

describe('csv', () => {
	test('objects flattened with a dot, arrays as JSON, quotes doubled, empty input is an empty string', () => {
		// json2csv 5.0.7: a null object in another row adds its own column after the flattened ones.
		expect(service.transform(rows, 'csv')).toBe(
			'"id","title","author.name","tags","author"\n1,"a","Ann","[1,2]",\n2,"b, ""quoted""",,"[]",',
		);

		expect(service.transform([], 'csv')).toBe('');
	});

	test('csv_utf8 adds the byte order mark; fields and no header (batches of exportToFile)', () => {
		expect(service.transform([{ id: 1 }], 'csv_utf8')).toBe('\uFEFF"id"\n1');
		expect(service.transform([{ id: 1, title: 'a' }], 'csv', { fields: ['title'], includeHeader: false })).toBe(
			'\n"a"',
		);
	});

	test('no data: the TypeError of input.length (500 at respond, spec FR-021)', () => {
		expect(() => service.transform(undefined as any, 'csv')).toThrow(TypeError);
	});
});

test('yaml', () => {
	expect(service.transform([{ id: 1, title: 'a' }], 'yaml')).toBe('- id: 1\n  title: a\n');
});

test('another format: 503 SERVICE_UNAVAILABLE', () => {
	expect(() => service.transform([], 'pdf' as any)).toThrow(
		expect.objectContaining({
			code: 'SERVICE_UNAVAILABLE',
			message: 'Service "export" is unavailable. Illegal export type used: "pdf".',
		}),
	);
});
