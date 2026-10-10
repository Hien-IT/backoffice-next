// Feature 003 (SC-005, contracts/db-writes.md §1): the rows a login writes, in each mode, compared between the apps
// with scenario() (one user per app, research R11) and read from the host.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { captureDbEffects, closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, createUserPerApp, PASSWORD, type User, urls } from './fixtures.js';
import { alias, assertSameTranscripts, scenario, send, snapshotOf } from './scenario.js';

const [vendor] = getDbsToTest();
let users: Record<App, User>;

beforeAll(async () => {
	users = await createUserPerApp('login-db');
}, 60_000);

afterAll(async () => {
	await cleanupFixtures();
	await closeHostDb();
}, 60_000);

const headers = { 'user-agent': 'parity-agent', origin: 'http://parity.example' };

function loginEffects(body: (user: User) => Record<string, unknown>) {
	return scenario(urls(), async ({ app, url, host }) => {
		const user = users[app];
		let response!: Awaited<ReturnType<typeof send>>;

		const raw = await captureDbEffects(user.id, async () => {
			response = await send(url, { method: 'POST', path: '/auth/login', headers, body: body(user) }, host);
		});

		return alias(
			{ response: snapshotOf('/auth/login', response), effects: normalizeEffects(raw) },
			{ [user.id]: '<user>', [user.email]: '<email>' },
		);
	});
}

describe('login writes (contracts/db-writes.md §1)', () => {
	it.each(['json', 'cookie', 'session'])('mode %s: a session, activity `login`, last_access', async (mode) => {
		const transcripts = await loginEffects((user) => ({ email: user.email, password: PASSWORD, mode }));

		assertSameTranscripts(transcripts, `login ${mode}`);

		const { effects } = transcripts.backoffice as { effects: { sessions: unknown[]; activity: unknown[] } };
		expect(effects.sessions).toHaveLength(1);
		expect(effects.activity).toEqual([expect.objectContaining({ action: 'login', collection: 'directus_users' })]);
	});

	it('a failed login writes nothing', async () => {
		const transcripts = await loginEffects((user) => ({ email: user.email, password: 'wrong' }));

		assertSameTranscripts(transcripts, 'failed login');

		const { effects } = transcripts.backoffice as { effects: { sessions: unknown[]; activity: unknown[] } };
		expect(effects.sessions).toEqual([]);
		expect(effects.activity).toEqual([]);
	});

	// The host only reads SQLite (FR-103): the expired session is written on the other vendors.
	it.skipIf(vendor === 'sqlite3')('expired sessions are deleted', async () => {
		const expired = (app: App) => `expired-${app}`.padEnd(64, '0');

		for (const app of ['directus', 'backoffice'] as const) {
			await hostDb()('directus_sessions').insert({ token: expired(app), user: users[app].id, expires: new Date(1000) });
		}

		await loginEffects((user) => ({ email: user.email, password: PASSWORD }));

		const left = await hostDb()('directus_sessions').whereIn('token', [expired('directus'), expired('backoffice')]);
		expect(left).toEqual([]);
	});
});
