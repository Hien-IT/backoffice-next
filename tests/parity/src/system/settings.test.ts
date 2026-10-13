// Feature 010, US1 (spec FR-010 to FR-012, FR-014, contracts/system-api.md §1): /settings at both apps. Reads go to
// both apps at once; writes run as scenarios (Directus, then Backoffice) with the settings row each app leaves. The
// owner report goes to the test registry (COMPLIANCE_URL of the env): Directus sends one, Backoffice none (D-38).
// Changes made at one app take effect at the other (password policy, failed logins, /server/info).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { registryPort } from '../config.js';
import { type AppName, appRequest } from '../directus-api.js';
import { capture } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, warnLines } from './helpers.js';

const OWNER_FIELDS = ['project_owner', 'project_usage', 'org_name', 'product_updates', 'project_status'];

const WRITTEN = [
	'project_name',
	'project_color',
	'project_logo',
	'theme_light_overrides',
	'custom_css',
	'auth_password_policy',
	'auth_login_attempts',
	'storage_asset_presets',
	...OWNER_FIELDS,
];

let original: Record<string, unknown>;
let appUser: TestUser; // app access: the minimal read of directus_settings
let updater: TestUser; // update on directus_settings, no read (no app access)

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });
const settingsRow = async () => comparable(await hostDb()('directus_settings').select(WRITTEN).orderBy('id').first());
const ownerReports = async () =>
	(await (await fetch(`http://127.0.0.1:${registryPort}/v1/owner`)).json()) as { count: number };

beforeAll(async () => {
	original = await hostDb()('directus_settings').select(WRITTEN).orderBy('id').first();

	const appPolicy = await createPolicy('directus', 'settings-app', { app: true });
	const updatePolicy = await createPolicy('directus', 'settings-update', {
		permissions: [{ collection: 'directus_settings', action: 'update', fields: ['*'], permissions: {} }],
	});

	appUser = await createUser('directus', 'settings-app');
	updater = await createUser('directus', 'settings-updater');
	await attachPolicy('directus', appPolicy, { user: appUser.id });
	await attachPolicy('directus', updatePolicy, { user: updater.id });
}, 300_000);

/** Puts the settings of the parity database back through Directus, as they were before this file. */
async function restore() {
	const { project_status: _s, ...values } = original;
	await appRequest('directus', 'PATCH', '/settings', values);
	await hostDb()('directus_settings').update({ project_status: original['project_status'] ?? null });
}

afterAll(async () => {
	await restore();
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('GET /settings at both apps', () => {
	it('admin: whole row, fields, meta; app access user: the minimal read; public: 403', async () => {
		const headers = await admin();

		await same({ path: '/settings', headers });
		await same({ path: '/settings?fields=project_name,project_color,public_background.id', headers });
		await same({ path: '/settings?fields=*&meta=*', headers });
		await same({ path: '/settings?fields=project_name', headers: bearer(appUser) });
		await same({ path: '/settings' });
	});

	it('OPTIONS and HEAD like the Directus router', async () => {
		const headers = await admin();

		await same({ method: 'OPTIONS', path: '/settings' });
		await same({ method: 'OPTIONS', path: '/settings/owner' });
		await same({ method: 'OPTIONS', path: '/settings/other' });
		await same({ method: 'HEAD', path: '/settings', headers });
	});
});

describe('PATCH /settings as scenarios', () => {
	afterEach(restore, 60_000);

	it('admin: branding and theme written, the row and the response read again match', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const patched = await call(ctx, {
				method: 'PATCH',
				path: '/settings?fields=project_name,project_color,theme_light_overrides,custom_css',
				headers,
				body: {
					project_name: 'Parity Project',
					project_color: '#112233',
					theme_light_overrides: { primary: '#ff0000' },
					custom_css: 'body { color: red; }',
				},
			});

			const row = await settingsRow();
			await restore();
			return { patched: snap(patched, '/settings'), row };
		});

		assertSameTranscripts(transcripts, 'PATCH /settings');
	});

	it('update without read: 204 without a body; bad field: same error', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const ok = await call(ctx, {
				method: 'PATCH',
				path: '/settings',
				headers: bearer(updater),
				body: { project_descriptor: 'by updater' },
			});
			const bad = await call(ctx, {
				method: 'PATCH',
				path: '/settings',
				headers: await admin(),
				body: { project_name: 'x'.repeat(5000) },
			});
			const row = await settingsRow();
			await restore();
			return { ok: snap(ok, '/settings'), bad: snap(bad, '/settings'), row };
		});

		assertSameTranscripts(transcripts, 'PATCH /settings without read');
		expect(transcripts.backoffice.ok.status).toBe(204);
	});
});

describe('POST /settings/owner (FR-012, D-38)', () => {
	afterEach(restore, 60_000);

	it('same row and response at both apps; Directus reports to COMPLIANCE_URL, Backoffice does not', async () => {
		const reports: Record<AppName, number> = { directus: 0, backoffice: 0 };
		const warnings = warnLines('backoffice-api', 'owner report is out of scope');

		const transcripts = await scenario(urls(), async (ctx) => {
			const before = (await ownerReports()).count;
			const res = await call(ctx, {
				method: 'POST',
				path: '/settings/owner',
				headers: await admin(),
				body: {
					project_owner: 'owner@example.com',
					project_usage: 'commercial',
					org_name: 'Parity',
					product_updates: true,
				},
			});

			// The report is sent without waiting (sendReport is not awaited by Directus).
			await new Promise((resolve) => setTimeout(resolve, 1_000));
			reports[ctx.app] = (await ownerReports()).count - before;
			const row = await settingsRow();
			await restore();
			return { res: snap(res, '/settings/owner'), row };
		});

		assertSameTranscripts(transcripts, 'POST /settings/owner');
		expect(transcripts.backoffice.row).toMatchObject({ project_owner: 'owner@example.com', project_status: null });
		expect(reports).toEqual({ directus: 1, backoffice: 0 });
		expect(warnLines('backoffice-api', 'owner report is out of scope')).toBe(warnings + 1);
	});

	it('a user without update permission on directus_settings: same error', async () => {
		await same({
			method: 'POST',
			path: '/settings/owner',
			headers: bearer(appUser),
			body: { project_owner: 'x@example.com', project_usage: null, org_name: null, product_updates: false },
		});
	});
});

describe('settings written at one app take effect at the other (FR-014)', () => {
	afterEach(restore, 60_000);

	const pairs: [AppName, AppName][] = [
		['backoffice', 'directus'],
		['directus', 'backoffice'],
	];

	it.each(pairs)('project_name written at %s is the project name of /server/info at %s', async (writer, reader) => {
		await appRequest(writer, 'PATCH', '/settings', { project_name: `Parity ${writer}` });
		const res = await capture(urls()[reader], { path: '/server/info', headers: { 'cache-control': 'no-store' } });
		expect((res.json as any).data.project.project_name).toBe(`Parity ${writer}`);
	});

	it.each(pairs)('auth_password_policy written at %s rejects a weak password at %s', async (writer, reader) => {
		const user = await createUser('directus', 'settings-policy');
		await appRequest(writer, 'PATCH', '/settings', { auth_password_policy: '/^.{20,}$/' });

		const res = await capture(urls()[reader], {
			method: 'PATCH',
			path: `/users/${user.id}`,
			headers: await admin(),
			body: { password: 'short-password' },
		});

		expect(res.status).toBe(400);
		expect((res.json as any).errors[0].extensions.code).toBe('FAILED_VALIDATION');
	});

	it.each(pairs)('auth_login_attempts written at %s suspends the user at %s', async (writer, reader) => {
		const user = await createUser('directus', 'settings-attempts');
		await appRequest(writer, 'PATCH', '/settings', { auth_login_attempts: 2 });

		for (let i = 0; i < 3; i++) {
			await capture(urls()[reader], {
				method: 'POST',
				path: '/auth/login',
				body: { email: user.email, password: 'wrong' },
			});
		}

		expect((await hostDb()('directus_users').select('status').where({ id: user.id }).first()).status).toBe('suspended');
	});
});
