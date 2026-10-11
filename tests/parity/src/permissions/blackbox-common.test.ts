// Ported from directus/tests/blackbox/common/common.test.ts (createRole() and createUser(), 7 cases), feature 004
// FR-100.
// Backoffice: each case runs at each app with fixtures made through that app's API (scenario()), then the two
// answers are compared; names carry the app so the two fixtures do not collide, the assertions of the blackbox test
// are kept for each app.
import { afterAll, describe, expect, it } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, send, snapshotOf } from '../auth/scenario.js';
import { adminToken, type AppName } from '../directus-api.js';
import { cleanup, CreatePolicy, CreateRole, CreateUser, uniqueName } from './fixtures.js';

afterAll(cleanup, 60_000);

const USER = {
	ADMIN: { TOKEN: 'AdminToken', EMAIL: 'admin@default.com', PASSWORD: 'AdminPassword', NAME: 'Admin User' },
	APP_ACCESS: {
		TOKEN: 'AppAccessToken',
		EMAIL: 'app-access@default.com',
		PASSWORD: 'AppAccessPassword',
		NAME: 'App Access User',
	},
	API_ONLY: {
		TOKEN: 'APIOnlyToken',
		EMAIL: 'api-only@default.com',
		PASSWORD: 'APIOnlyPassword',
		NAME: 'API Only User',
	},
	NO_ROLE: { TOKEN: 'NoRoleToken', EMAIL: 'no-role@default.com', PASSWORD: 'NoRolePassword', NAME: 'No-Role User' },
};

const ROLE = {
	ADMIN: { NAME: 'Test Admin Role' },
	APP_ACCESS: { NAME: 'Test App Access Role' },
	API_ONLY: { NAME: 'Test API Only Role' },
};

describe('Common', () => {
	describe('createRole()', () => {
		it.each([
			['Creates default admin role and policy', ROLE.ADMIN.NAME, true, true],
			['Creates default app access role and policy', ROLE.APP_ACCESS.NAME, true, false],
			['Creates default API only role and policy', ROLE.API_ONLY.NAME, false, false],
		])('%s', async (_title, baseName, appAccess, adminAccess) => {
			const run = uniqueName('parity');

			const transcripts = await scenario(urls(), async (ctx) => {
				// Setup
				const roleName = `${baseName} ${run} ${ctx.app}`;
				const policyName = `${roleName}'s Policy`;

				// Action
				const role = await CreateRole(ctx.app as AppName, { name: roleName });

				await CreatePolicy(ctx.app as AppName, {
					name: policyName,
					appAccessEnabled: appAccess,
					adminAccessEnabled: adminAccess,
					role,
				});

				const headers = { authorization: `Bearer ${await adminToken(ctx.app as AppName)}` };
				const query = (name: string, fields: string[]) =>
					`filter=${encodeURIComponent(JSON.stringify({ name: { _eq: name } }))}&fields=${fields.join(',')}&limit=1`;

				const roleResponse = await send(
					ctx.url,
					{ path: `/roles?${query(roleName, ['id', 'name'])}`, headers },
					ctx.host,
				);

				const policyResponse = await send(
					ctx.url,
					{ path: `/policies?${query(policyName, ['id', 'name', 'app_access', 'admin_access'])}`, headers },
					ctx.host,
				);

				// Assert
				expect(roleResponse.status).toBe(200);
				expect(roleResponse.headers['content-type']).toMatch(/application\/json/);
				expect((roleResponse.json as any).data).toEqual([{ id: expect.any(String), name: roleName }]);

				expect(policyResponse.status).toBe(200);
				expect((policyResponse.json as any).data).toEqual([
					{ id: expect.any(String), name: policyName, app_access: appAccess, admin_access: adminAccess },
				]);

				const strip = (snapshot: any) =>
					JSON.parse(JSON.stringify(snapshot).split(ctx.app).join('<app>').split(role.id).join('<role>'));

				return {
					role: strip(snapshotOf('/roles', roleResponse)),
					policy: { ...strip(snapshotOf('/policies', policyResponse)), body: { data: '<checked above>' } },
				};
			});

			assertSameTranscripts(transcripts, 'createRole');
		});
	});

	describe('createUser()', () => {
		it.each([
			['Creates default admin user', USER.ADMIN, ROLE.ADMIN.NAME, true, true],
			['Creates default app access user', USER.APP_ACCESS, ROLE.APP_ACCESS.NAME, true, false],
			['Creates default API only user', USER.API_ONLY, ROLE.API_ONLY.NAME, false, false],
			['Creates default no-role user', USER.NO_ROLE, null, false, false],
		] as const)('%s', async (_title, user, roleName, appAccess, adminAccess) => {
			const run = uniqueName('parity');

			const transcripts = await scenario(urls(), async (ctx) => {
				const app = ctx.app as AppName;

				// Setup: the role of the user, made like createRole() above (the blackbox suite runs that first).
				let roleId: string | undefined;

				if (roleName) {
					const role = await CreateRole(app, { name: `${roleName} ${run} ${ctx.app}` });
					await CreatePolicy(app, {
						name: `${role.name}'s Policy`,
						appAccessEnabled: appAccess,
						adminAccessEnabled: adminAccess,
						role,
					});
					roleId = role.id;
				}

				const email = `${run}-${ctx.app}-${user.EMAIL}`;

				// Action
				await CreateUser(app, {
					token: `${user.TOKEN}-${run}-${ctx.app}`,
					email,
					password: user.PASSWORD,
					name: user.NAME,
					...(roleId ? { role: roleId } : {}),
				});

				const headers = { authorization: `Bearer ${await adminToken(app)}` };
				const query = `filter=${encodeURIComponent(JSON.stringify({ email: { _eq: email } }))}&fields=id,email,token,role`;
				const response = await send(ctx.url, { path: `/users?${query}`, headers }, ctx.host);

				// Assert
				expect(response.status).toBe(200);
				expect(response.headers['content-type']).toMatch(/application\/json/);
				expect((response.json as any).data).toEqual([
					{ id: expect.any(String), email, token: expect.any(String), role: roleId ? expect.any(String) : null },
				]);

				const data = (response.json as any).data[0];
				const strip = (value: unknown) =>
					JSON.parse(
						JSON.stringify(value)
							.split(data.id)
							.join('<user>')
							.split(String(roleId))
							.join('<role>')
							.split(ctx.app)
							.join('<app>'),
					);

				return strip(snapshotOf('/users', response));
			});

			assertSameTranscripts(transcripts, 'createUser');
		});
	});
});
