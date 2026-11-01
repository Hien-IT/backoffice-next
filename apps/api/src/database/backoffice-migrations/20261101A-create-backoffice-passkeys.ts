// Backoffice (spec 029, D-207.1, D-207.5): the passkeys of local users and the passkey mark of a session.
// - backoffice_passkeys: one WebAuthn credential per row (data-model.md). No foreign key, so DR sees no constraint on
//   directus_users; rows of a user DR deleted are ignored when read. No directus_fields rows (hidden system collection).
// - directus_sessions.bo_passkey: true on a session row a passkey login created, kept by refresh; GET /policies/me/globals
//   answers enforce_tfa false for that session. Null (DR rows) means not a passkey. Its directus_fields row (hidden,
//   read-only, labelled) keeps the Data Model of both apps from listing it as "Database Only", like 022 does.
// Re-runnable, and safe when two processes without a shared lock run it at once.
import type { Knex } from 'knex';

export const version = '20261101A';
export const name = 'Create Backoffice Passkeys';

const TABLE = 'backoffice_passkeys';

export async function up(knex: Knex): Promise<void> {
	if (!(await knex.schema.hasTable(TABLE))) {
		try {
			await knex.schema.createTable(TABLE, (table) => {
				table.uuid('id').primary().notNullable();
				table.uuid('user').notNullable().index('backoffice_passkeys_user_index');
				// shortcut: WebAuthn allows credential ids up to 1023 bytes; real authenticators use 16-64. Longer ids get
				// 400 at registration; move to a text column plus a hash when an authenticator needs more.
				table.string('credential_id', 255).notNullable().unique('backoffice_passkeys_credential_id_unique');
				table.text('public_key').notNullable();
				table.bigInteger('counter').notNullable().defaultTo(0);
				table.json('transports').nullable();
				table.string('name', 100).notNullable();
				table.string('device_type', 32).nullable();
				table.boolean('backed_up').notNullable().defaultTo(false);
				table.boolean('discoverable').notNullable().defaultTo(true);
				table.timestamp('date_created').notNullable().defaultTo(knex.fn.now());
				// Explicitly nullable: MySQL 5.7 without explicit_defaults_for_timestamp gives a second timestamp NOT NULL.
				table.timestamp('last_used').nullable();
			});
		} catch (error) {
			// Another process without a shared lock created it first (CI 40298326039).
			if (!(await knex.schema.hasTable(TABLE))) throw error;
		}
	}

	if (!(await knex.schema.hasColumn('directus_sessions', 'bo_passkey'))) {
		try {
			await knex.schema.alterTable('directus_sessions', (table) => {
				table.boolean('bo_passkey').nullable();
			});
		} catch (error) {
			if (!(await knex.schema.hasColumn('directus_sessions', 'bo_passkey'))) throw error;
		}
	}

	const where = { collection: 'directus_sessions', field: 'bo_passkey' };

	if ((await knex.select('id').from('directus_fields').where(where)).length === 0) {
		await knex
			.insert({
				...where,
				// MySQL and SQLite store booleans as numbers: cast-boolean gives true/false like the DR fields.
				special: 'cast-boolean',
				interface: 'boolean',
				readonly: true,
				hidden: true,
				width: 'half',
				// A string, not an object: every vendor's driver stores it as the JSON of the column.
				translations: JSON.stringify([
					{ language: 'en-US', translation: 'Passkey Session' },
					{ language: 'vi-VN', translation: 'Phiên passkey' },
				]),
			})
			.into('directus_fields');
	}

	// Two processes without a shared lock may both have inserted it: keep the first row.
	const rows = await knex.select('id').from('directus_fields').where(where).orderBy('id');

	if (rows.length > 1) {
		await knex('directus_fields')
			.whereIn(
				'id',
				rows.slice(1).map((r) => r.id),
			)
			.delete();
	}
}
