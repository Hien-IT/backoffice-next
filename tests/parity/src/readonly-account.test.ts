// FR-024, US1.10: the API runs with a database role that only has SELECT. Postgres only (bộ `full`).
import getPort from 'get-port';
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { knexConfig } from './config.js';
import { getDbsToTest } from './get-dbs-to-test.js';
import { capture } from './parity.js';
import { signAccessToken } from './auth/tokens.js';
import { cleanup, createUser } from './permissions/fixtures.js';
import { type RequestSetAccounts, requestSet } from './request-set.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './startup/run-api.js';

const [vendor] = getDbsToTest();
const ROLE = 'backoffice_readonly';

describe.runIf(vendor === 'postgres')('read-only database account', () => {
	let admin: Knex;
	let api: RunningApi;
	let port: number;
	let accounts: RequestSetAccounts;

	beforeAll(async () => {
		admin = knex(knexConfig.postgres);
		const user = await createUser('directus', 'parity-readonly', { role: null });
		const adminUser = await admin('directus_users').where({ email: 'admin@example.com' }).first();
		accounts = {
			adminJwt: signAccessToken({ id: adminUser.id, role: adminUser.role, app_access: true, admin_access: true }),
			adminId: adminUser.id,
			userToken: user.token,
			userId: user.id,
		};
		await admin.raw(`drop owned by ${ROLE} cascade`).catch(() => undefined);
		await admin.raw(`drop role if exists ${ROLE}`);
		await admin.raw(`create role ${ROLE} login password 'readonly'`);
		await admin.raw(`grant connect on database directus to ${ROLE}`);
		await admin.raw(`grant usage on schema public to ${ROLE}`);
		await admin.raw(`grant select on all tables in schema public to ${ROLE}`);

		port = await getPort();
		// Same configuration as the shared env file, only the DB account differs; metrics on (T091) with a run every second.
		api = runApi({
			...hostDbEnv('postgres'),
			DB_USER: ROLE,
			DB_PASSWORD: 'readonly',
			PORT: String(port),
			METRICS_ENABLED: 'true',
			METRICS_TOKENS: 'readonly-token',
			METRICS_SCHEDULE: '* * * * * *',
		});
	}, 60_000);

	afterAll(async () => {
		await stopApi(api);
		await admin.raw(`drop owned by ${ROLE} cascade`);
		await admin.raw(`drop role if exists ${ROLE}`);
		await admin.destroy();
		await cleanup();
	});

	test('starts and serves every request without 500 or permission errors', async () => {
		expect(await waitForPing(api, port), api.output()).toBe(true);

		for (const req of [
			...requestSet({ metrics: true, accounts }),
			{ path: '/metrics', headers: { authorization: 'Metrics readonly-token' } },
		]) {
			const res = await capture(`http://127.0.0.1:${port}`, req);
			expect(res.status, `${req.path}: ${res.text}`).not.toBe(500);
		}

		// At least one metric run (database, cache, Redis and storage checks) with the read-only account.
		await new Promise((r) => setTimeout(r, 2500));
		const metrics = await capture(`http://127.0.0.1:${port}`, {
			path: '/metrics',
			headers: { authorization: 'Metrics readonly-token' },
		});
		expect(metrics.status).toBe(200);
		expect(metrics.text).toMatch(/directus_db_pg_connection_errors 0/);

		expect(api.text()).not.toMatch(/permission denied/i);
	});
});
