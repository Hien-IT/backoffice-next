// Feature 006: the app the controller tests of /collections, /fields, /relations and /schema talk to, on the SQLite
// auth test database with one user collection (`articles`) so collection-exists answers like DR. The services
// are mocked by each test file; this file only builds the database and the agent.
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import request from 'supertest';
import { type App, createApp } from '../src/app.js';
import { createAuthDb } from './directus-db.js';

export const SECRET = 'test-secret';
export const ADMIN = 'd0000000-0000-4000-8000-000000000009';
export const USER = 'd0000000-0000-4000-8000-000000000001';

export const token = (id: string) =>
	// nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret -- literal secret of the controller test app only
	`Bearer ${jwt.sign({ id, role: null, app_access: false, admin_access: false }, SECRET, { issuer: 'directus' })}`;

export async function createDataModelDb(): Promise<Knex> {
	const db = await createAuthDb();

	await db.schema.createTable('articles', (t) => {
		t.increments('id');
		t.string('title');
	});

	await db('directus_collections').insert([{ collection: 'articles' }]);

	const adminPolicy = 'b0000000-0000-4000-8000-000000000009';
	await db('directus_policies').insert([{ id: adminPolicy, name: 'Admin', admin_access: true, app_access: true }]);
	await db('directus_users').insert([
		{ id: ADMIN, email: 'admin@example.com' },
		{ id: USER, email: 'user@example.com' },
	]);
	await db('directus_access').insert([
		{ id: 'c0000000-0000-4000-8000-000000000009', user: ADMIN, policy: adminPolicy },
	]);

	return db;
}

export async function startApp(): Promise<{ app: App; agent: ReturnType<typeof request> }> {
	const app = await createApp();
	return { app, agent: request(app.express) };
}
