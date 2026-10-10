// Test helper: an in-memory SQLite database with the Directus system tables feature 001 reads (columns as created
// by the Directus 11.17.4 migrations, reduced to what the queries touch).
import knex, { type Knex } from 'knex';

export async function createDirectusDb(): Promise<Knex> {
	const db = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });

	await db.schema.createTable('directus_collections', (t) => {
		t.string('collection', 64).primary();
		t.boolean('singleton').defaultTo(false);
		t.text('note');
		t.string('sort_field', 64);
		t.string('accountability').defaultTo('all');
	});

	await db.schema.createTable('directus_fields', (t) => {
		t.increments('id');
		t.string('collection', 64);
		t.string('field', 64);
		t.string('special');
		t.text('note');
		t.json('validation');
		t.boolean('searchable').defaultTo(true);
	});

	await db.schema.createTable('directus_relations', (t) => {
		t.increments('id');
		t.string('many_collection', 64);
		t.string('many_field', 64);
		t.string('one_collection', 64);
		t.string('one_field', 64);
		t.string('one_collection_field', 64);
		t.text('one_allowed_collections');
		t.string('junction_field', 64);
		t.string('sort_field', 64);
		t.string('one_deselect_action').defaultTo('nullify');
	});

	await db.schema.createTable('directus_policies', (t) => {
		t.uuid('id').primary();
		t.string('name');
		t.text('ip_access');
	});

	await db.schema.createTable('directus_access', (t) => {
		t.uuid('id').primary();
		t.uuid('role');
		t.uuid('user');
		t.uuid('policy');
		t.integer('sort');
	});

	await db.schema.createTable('directus_permissions', (t) => {
		t.increments('id');
		t.string('collection', 64);
		t.string('action', 10);
		t.json('permissions');
		t.json('validation');
		t.json('presets');
		t.text('fields');
		t.uuid('policy');
	});

	await db.schema.createTable('directus_users', (t) => {
		t.uuid('id').primary();
		t.string('email');
	});

	await db.schema.createTable('directus_files', (t) => {
		t.uuid('id').primary();
		t.string('type');
	});

	await db.schema.createTable('directus_settings', (t) => {
		t.increments('id');
		t.string('project_name', 100).notNullable().defaultTo('Directus');
		t.string('project_descriptor', 100);
		t.uuid('project_logo');
		t.string('project_color', 255).defaultTo('#6644FF');
		t.string('default_appearance').notNullable().defaultTo('auto');
		t.string('default_theme_light');
		t.string('default_theme_dark');
		t.json('theme_light_overrides');
		t.json('theme_dark_overrides');
		t.string('default_language').notNullable().defaultTo('en-US');
		t.uuid('public_foreground');
		t.uuid('public_background');
		t.uuid('public_favicon');
		t.text('public_note');
		t.text('custom_css');
		t.boolean('public_registration').notNullable().defaultTo(false);
		t.boolean('public_registration_verify_email').defaultTo(true);
	});

	return db;
}

export const PUBLIC_POLICY = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17';

/**
 * Feature 003: the tables and columns the auth flows read and write, on top of createDirectusDb (columns as created
 * by the Directus 11.17.4 migrations, reduced to what the auth code touches).
 */
export async function createAuthDb(): Promise<Knex> {
	const db = await createDirectusDb();

	await db.schema.alterTable('directus_users', (t) => {
		t.string('first_name', 50);
		t.string('last_name', 50);
		t.string('password', 255);
		t.string('status', 16).notNullable().defaultTo('active');
		t.uuid('role');
		t.string('token', 255).unique();
		t.timestamp('last_access');
		t.string('tfa_secret', 255);
		t.string('provider', 128).notNullable().defaultTo('default');
		t.string('external_identifier', 255).unique();
		t.json('auth_data');
		t.boolean('email_notifications').defaultTo(true);
	});

	await db.schema.alterTable('directus_policies', (t) => {
		t.boolean('admin_access').notNullable().defaultTo(false);
		t.boolean('app_access').notNullable().defaultTo(false);
		t.boolean('enforce_tfa').notNullable().defaultTo(false);
	});

	await db.schema.createTable('directus_roles', (t) => {
		t.uuid('id').primary();
		t.string('name', 100);
		t.uuid('parent');
	});

	await db.schema.createTable('directus_sessions', (t) => {
		t.string('token', 64).primary();
		t.uuid('user');
		t.timestamp('expires').notNullable();
		t.string('ip', 255);
		t.string('user_agent');
		t.uuid('share');
		t.string('origin');
		t.string('next_token', 64);
	});

	await db.schema.createTable('directus_shares', (t) => {
		t.uuid('id').primary();
		t.timestamp('date_start');
		t.timestamp('date_end');
	});

	await db.schema.createTable('directus_activity', (t) => {
		t.increments('id');
		t.string('action', 45).notNullable();
		t.uuid('user');
		t.timestamp('timestamp').notNullable().defaultTo(db.fn.now());
		t.string('ip', 50);
		t.string('user_agent');
		t.string('collection', 64).notNullable();
		t.string('item', 255).notNullable();
		t.string('origin');
	});

	await db.schema.createTable('directus_revisions', (t) => {
		t.increments('id');
		t.integer('activity').notNullable();
		t.string('collection', 64).notNullable();
		t.string('item', 255).notNullable();
		t.json('data');
		t.json('delta');
		t.integer('parent');
		t.uuid('version');
	});

	await db.schema.alterTable('directus_settings', (t) => {
		t.integer('auth_login_attempts').defaultTo(25);
		t.string('auth_password_policy', 100);
	});

	return db;
}
