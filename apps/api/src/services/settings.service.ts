// Ported from directus/api/src/services/items.ts (readSingleton, items.ts:1190-1231) for directus_settings, as
// called by ServerService.serverInfo. Runs the SQL Directus' AST engine produces for that query (research R16.2);
// feature 005 replaces it with the real ItemsService and the /server/info parity tests keep guarding the output.
import type { AbstractServiceOptions, SchemaOverview } from '@backoffice/types';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';
import { castBoolean, castJson } from '../utils/cast-on-read.js';

/** The 16 plain fields of /server/info, in request order; `public_background` (m2o to files) comes last (FR-042). */
export const PROJECT_FIELDS = [
	'project_name',
	'project_descriptor',
	'project_logo',
	'project_color',
	'default_appearance',
	'default_theme_light',
	'default_theme_dark',
	'theme_light_overrides',
	'theme_dark_overrides',
	'default_language',
	'public_foreground',
	'public_favicon',
	'public_note',
	'custom_css',
	'public_registration',
	'public_registration_verify_email',
] as const;

/** `special` of these fields in @backoffice/system-data (directus_settings). */
const CASTS: Record<string, (value: unknown) => unknown> = {
	public_registration: castBoolean,
	public_registration_verify_email: castBoolean,
	theme_light_overrides: castJson,
	theme_dark_overrides: castJson,
};

export class SettingsService {
	knex: Knex;
	schema: SchemaOverview | undefined;

	constructor(options: Partial<AbstractServiceOptions>) {
		this.knex = options.knex || getDatabase();
		this.schema = options.schema;
	}

	/** readSingleton({ fields: [...16 fields, 'public_background.id', 'public_background.type'] }) */
	async readProjectInfo(): Promise<Record<string, unknown>> {
		const row = await this.knex
			.select(...PROJECT_FIELDS, 'public_background', 'id')
			.from('directus_settings')
			.orderBy('id', 'asc')
			.first();

		if (!row) return await this.defaults();

		const project: Record<string, unknown> = {};

		for (const field of PROJECT_FIELDS) {
			project[field] = CASTS[field] ? CASTS[field](row[field]) : row[field];
		}

		project['public_background'] = row.public_background ? await this.readFile(row.public_background) : null;

		return project;
	}

	private async readFile(id: string): Promise<{ id: string; type: string | null } | null> {
		const file = await this.knex.select('id', 'type').from('directus_files').whereIn('id', [id]).first();
		return file ?? null;
	}

	/** No settings row (only when deleted by hand): the column defaults that are not null, in schema order. */
	private async defaults(): Promise<Record<string, unknown>> {
		// The schema of the request (schema middleware, feature 002); Directus requires it too.
		const schema = this.schema!;
		const collection = schema.collections['directus_settings']!;
		const defaults: Record<string, unknown> = {};

		for (const [name, field] of Object.entries(collection.fields)) {
			if (!(PROJECT_FIELDS as readonly string[]).includes(name)) continue;

			if (collection.primary === name) {
				defaults[name] = null;
				continue;
			}

			if (field.defaultValue !== null) defaults[name] = field.defaultValue;
		}

		return defaults;
	}
}
