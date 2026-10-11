// Ported from directus/api/src/services/import-export.ts (ExportService: constructor and transform)
// Backoffice: exportToFile, getHeadingsForCsvExport and ImportService (background export and import through /utils,
// directus_files and notifications) come with feature 010; respond() only needs transform() (spec FR-020, FR-021).
import { ServiceUnavailableError } from '@backoffice/errors';
import type { AbstractServiceOptions, Accountability, ExportFormat, SchemaOverview } from '@backoffice/types';
import { dump as toYAML } from 'js-yaml';
import { parse as toXML } from 'js2xmlparser';
import { Parser as CSVParser, transforms as CSVTransforms } from 'json2csv';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';

export class ExportService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
	}

	/**
	 * Transform a given input object / array to the given type
	 */
	transform(
		input: Record<string, any>[],
		format: ExportFormat,
		options?: {
			includeHeader?: boolean;
			includeFooter?: boolean;
			fields?: string[] | null;
		},
	): string {
		if (format === 'json') {
			let string = JSON.stringify(input || null, null, '\t');

			if (options?.includeHeader === false) string = string.split('\n').slice(1).join('\n');

			if (options?.includeFooter === false) {
				const lines = string.split('\n');
				string = lines.slice(0, lines.length - 1).join('\n');
				string += ',\n';
			}

			return string;
		}

		if (format === 'xml') {
			let string = toXML('data', input);

			if (options?.includeHeader === false) string = string.split('\n').slice(2).join('\n');

			if (options?.includeFooter === false) {
				const lines = string.split('\n');
				string = lines.slice(0, lines.length - 1).join('\n');
				string += '\n';
			}

			return string;
		}

		if (format.startsWith('csv')) {
			if (input.length === 0) return '';

			const transforms = [CSVTransforms.flatten({ separator: '.' })];
			const header = options?.includeHeader !== false;
			const withBOM = format === 'csv_utf8';

			const transformOptions = options?.fields
				? { transforms, header, fields: options?.fields, withBOM }
				: { transforms, header, withBOM };

			let string = new CSVParser(transformOptions).parse(input);

			if (options?.includeHeader === false) {
				string = '\n' + string;
			}

			return string;
		}

		if (format === 'yaml') {
			return toYAML(input);
		}

		throw new ServiceUnavailableError({ service: 'export', reason: `Illegal export type used: "${format}"` });
	}
}
