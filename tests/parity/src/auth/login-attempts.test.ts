// Feature 003, US4.4, US4.5, SC-004 (contracts/db-writes.md §3): the failed-login counter is shared through Redis
// (key rlflx:<user id>), so failures at both apps add up and the user is suspended at the same attempt as with
// Directus alone, with the same activity and revision.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capture } from '../parity.js';
import { redis, closeRedis } from '../redis.js';
import { captureDbEffects, closeHostDb, hostDb, normalizeEffects } from './db-effects.js';
import { type App, cleanupFixtures, createUser, PASSWORD, setSettings, type User, urls } from './fixtures.js';
import { post } from './flows.js';
import { alias } from './scenario.js';

let restore: () => Promise<void>;

beforeAll(async () => {
	restore = await setSettings({ auth_login_attempts: 3 });
}, 60_000);

afterAll(async () => {
	await restore();
	await cleanupFixtures();
	await closeHostDb();
	await closeRedis();
}, 60_000);

// From the database: GET /users/:id of Directus can answer from its response cache.
const userStatus = async (user: User) =>
	(await hostDb()('directus_users').select('status').where({ id: user.id }).first()).status as string;

async function attempt(app: App, user: User, password = 'wrong') {
	const res = await capture(urls()[app], post('/auth/login', { email: user.email, password }));
	return { status: res.status, code: (res.json as any)?.errors?.[0]?.extensions?.code, user: await userStatus(user) };
}

/** Wrong passwords at `apps` in turn until the user is suspended (at most 6 attempts), with the rows written. */
async function untilSuspended(user: User, apps: App[]) {
	const attempts: Awaited<ReturnType<typeof attempt>>[] = [];

	const raw = await captureDbEffects(user.id, async () => {
		for (let i = 0; i < 6 && attempts.at(-1)?.user !== 'suspended'; i++)
			attempts.push(await attempt(apps[i % apps.length]!, user));
	});

	return alias({ attempts, effects: normalizeEffects(raw) }, { [user.id]: '<user>', [user.email]: '<email>' });
}

describe('auth_login_attempts = 3', () => {
	it('failures alternating between the apps suspend the user at the same attempt as Directus alone', async () => {
		const alone = await untilSuspended(await createUser('attempts-alone'), ['directus']);
		const both = await untilSuspended(await createUser('attempts-both'), ['directus', 'backoffice']);

		expect(both).toEqual(alone);
		expect(alone.attempts.at(-1)).toMatchObject({ user: 'suspended' });
		expect((alone.effects as any).activity).toEqual([expect.objectContaining({ action: 'update' })]);
	});

	it('the counter is the same Redis key for both apps', async () => {
		const user = await createUser('attempts-key');

		await attempt('directus', user);
		expect(await redis().get(`rlflx:${user.id}`)).toBe('1');

		await attempt('backoffice', user);
		expect(await redis().get(`rlflx:${user.id}`)).toBe('2');
	});

	it('a successful login at the other app resets the counter', async () => {
		const user = await createUser('attempts-reset');

		await attempt('directus', user);
		await attempt('directus', user);
		expect((await attempt('backoffice', user, PASSWORD)).status).toBe(200);

		for (let i = 0; i < 3; i++) await attempt('directus', user);
		expect(await userStatus(user)).toBe('active');
	});

	it('null: no suspension (US4.5)', async () => {
		const back = await setSettings({ auth_login_attempts: null });

		try {
			const user = await createUser('attempts-null');
			for (let i = 0; i < 6; i++) await attempt(i % 2 ? 'backoffice' : 'directus', user);
			expect(await userStatus(user)).toBe('active');
		} finally {
			await back();
		}
	});
});
