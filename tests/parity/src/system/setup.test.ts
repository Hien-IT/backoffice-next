// Feature 010, US1 ca 4 (spec FR-013, contracts/parity.md §3): POST /server/setup on the setup pair, which has its own
// Postgres without users (profile `setup`, research R11). Each app sets the project up in turn; the rows of the first
// admin (role, policy, access, user) and the owner fields are compared, then removed so the database has no user
// again. The owner report reaches the test registry from Directus only (D-38). R-28: two setups at once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registryPort } from '../config.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { capture } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { closeSetupDb, comparable, setupDb, warnLines } from './helpers.js';

type App = 'directus' | 'backoffice';

const pair = profileUrls('setup');
const enabled = getDbsToTest()[0] === 'postgres' && pair !== undefined;
const URLS: Record<App, string> = { directus: pair?.directusUrl ?? '', backoffice: pair?.backofficeUrl ?? '' };

const BODY = {
	project_owner: 'owner-setup@example.com',
	password: 'parity-setup-password-1',
	first_name: 'Ada',
	last_name: 'Setup',
	project_usage: 'commercial',
	org_name: 'Parity Setup',
	product_updates: true,
	license: true,
};

const OWNER = ['project_owner', 'project_usage', 'org_name', 'product_updates', 'project_status'];

let base: { roles: string[]; policies: string[]; access: string[] };

const ids = async (table: string) => (await setupDb().select('id').from(table)).map((row) => String(row['id']));
const ownerReports = async () =>
	((await (await fetch(`http://127.0.0.1:${registryPort}/v1/owner`)).json()) as { count: number }).count;

/** The rows written since `base`, in a comparable form, and their ids. */
async function newRows() {
	const db = setupDb();
	const roles = await db('directus_roles').whereNotIn('id', base.roles).orderBy('name');
	const policies = await db('directus_policies').whereNotIn('id', base.policies).orderBy('name');
	const access = await db('directus_access').whereNotIn('id', base.access);
	const users = await db('directus_users').select('*');
	const settings = await db('directus_settings').select(OWNER).first();

	const placeholders: Record<string, string> = {};
	roles.forEach((r, i) => (placeholders[`role:${i}`] = r.id));
	policies.forEach((p, i) => (placeholders[`policy:${i}`] = p.id));
	access.forEach((a, i) => (placeholders[`access:${i}`] = a.id));
	users.forEach((u, i) => (placeholders[`user:${i}`] = u.id));

	return {
		ids: { roles: roles.map((r) => r.id), policies: policies.map((p) => p.id), access: access.map((a) => a.id) },
		users: users.map((u) => u.id as string),
		rows: comparable({ roles, policies, access, users, settings }, placeholders),
	};
}

/** Removes what a setup wrote, so the database has no user again (contracts/parity.md §3). */
async function reset() {
	const db = setupDb();
	await db('directus_sessions').delete();
	await db('directus_access').whereNotIn('id', base.access).delete();
	await db('directus_users').delete();
	await db('directus_policies').whereNotIn('id', base.policies).delete();
	await db('directus_roles').whereNotIn('id', base.roles).delete();
	await db('directus_settings').update(
		Object.fromEntries(OWNER.map((c) => [c, c === 'product_updates' ? false : null])),
	);
}

const setup = (app: App, body: Record<string, unknown> = BODY) =>
	capture(URLS[app], { method: 'POST', path: '/server/setup', body });

const snapshot = (res: Awaited<ReturnType<typeof capture>>) => ({ status: res.status, body: res.json ?? res.text });

describe.skipIf(!enabled)('POST /server/setup on the setup pair (own Postgres)', () => {
	beforeAll(async () => {
		base = {
			roles: await ids('directus_roles'),
			policies: await ids('directus_policies'),
			access: await ids('directus_access'),
		};
		expect(await setupDb()('directus_users').count({ n: '*' }).first()).toMatchObject({ n: '0' });
	}, 60_000);

	afterAll(async () => {
		await reset();
		await closeSetupDb();
	}, 60_000);

	it('before setup: /server/info says so at both apps', async () => {
		const info = await Promise.all(
			(['directus', 'backoffice'] as App[]).map(async (app) =>
				comparable((await capture(URLS[app], { path: '/server/info', headers: { 'cache-control': 'no-store' } })).json),
			),
		);

		expect(info[1]).toEqual(info[0]);
		expect((info[0] as any).data.setupCompleted).toBe(false);
	});

	it('each app creates the same first admin and owner fields; the admin can log in at both apps', async () => {
		const transcripts: Partial<Record<App, unknown>> = {};
		const reports: Partial<Record<App, number>> = {};
		const warnings = warnLines('backoffice-api-setup', 'owner report is out of scope');

		for (const app of ['directus', 'backoffice'] as App[]) {
			const before = await ownerReports();
			const res = await setup(app);
			await new Promise((resolve) => setTimeout(resolve, 1_000)); // setOwner is not awaited

			const { rows } = await newRows();
			const logins = await Promise.all(
				(['directus', 'backoffice'] as App[]).map(
					async (at) =>
						(
							await capture(URLS[at], {
								method: 'POST',
								path: '/auth/login',
								body: { email: BODY.project_owner, password: BODY.password },
							})
						).status,
				),
			);

			reports[app] = (await ownerReports()) - before;
			transcripts[app] = { res: snapshot(res), rows, logins };
			await reset();
		}

		expect(transcripts.backoffice).toEqual(transcripts.directus);
		expect((transcripts.directus as any).res.status).toBe(204);
		expect((transcripts.directus as any).logins).toEqual([200, 200]);
		expect(reports).toEqual({ directus: 1, backoffice: 0 });
		expect(warnLines('backoffice-api-setup', 'owner report is out of scope')).toBe(warnings + 1);
	});

	it('a second setup is refused (403) at both apps', async () => {
		await setup('directus');
		await new Promise((resolve) => setTimeout(resolve, 500));
		const again = await Promise.all(
			(['directus', 'backoffice'] as App[]).map(async (app) => snapshot(await setup(app))),
		);
		await reset();

		expect(again[1]).toEqual(again[0]);
		expect(again[0]!.status).toBe(403);
	});

	it.each([
		['without project_owner', { ...BODY, project_owner: undefined }],
		['without password', { ...BODY, password: undefined }],
	])('%s: 204, a role, a policy and an access but no user (ADMIN_* are empty)', async (_label, body) => {
		const out: Partial<Record<App, unknown>> = {};

		for (const app of ['directus', 'backoffice'] as App[]) {
			const res = await setup(app, body);
			await new Promise((resolve) => setTimeout(resolve, 500));
			const { rows, users } = await newRows();
			out[app] = { res: snapshot(res), rows, users: users.length };
			await reset();
		}

		expect(out.backoffice).toEqual(out.directus);
		expect(out.directus).toMatchObject({ res: { status: 204 }, users: 0 });
	});

	it('R-28: two setups at once on an empty database (measured on Directus, same at Backoffice)', async () => {
		const counts: Partial<Record<App, { statuses: number[]; users: number; roles: number }>> = {};

		for (const app of ['directus', 'backoffice'] as App[]) {
			const statuses = (await Promise.all([setup(app), setup(app)])).map((res) => res.status).sort();
			await new Promise((resolve) => setTimeout(resolve, 1_000));
			const { users, ids: written } = await newRows();
			counts[app] = { statuses, users: users.length, roles: written.roles.length };
			await reset();
		}

		// The two requests check "no user yet" before either writes: either both create an admin or the second one meets
		// the unique email of the first (Directus 11.17.4 has no lock). Both apps accept the same outcomes.
		for (const app of ['directus', 'backoffice'] as App[]) {
			expect(counts[app]!.users).toBeGreaterThanOrEqual(1);
			expect(counts[app]!.roles).toBeGreaterThanOrEqual(1);
		}

		process.stdout.write(`R-28 measured: ${JSON.stringify(counts)}\n`);
	});
});
