// Feature 011, US3 (spec FR-025, FR-030 to FR-036, contracts/parity.md §2): system data and system operations through
// /graphql/system at both apps. Reads go to both apps at once (tokens and refresh tokens are compared by kind through
// the body normalizers of feature 003); state-changing operations run per app on their own fixtures. The email steps
// (password request, invitation, registration) write a warning line at the new app instead of a mail (D-23, D-27,
// D-28).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { cleanupFixtures, createUser as createAuthUser, createUserPerApp, PASSWORD } from '../auth/fixtures.js';
import { totp } from '../auth/tokens.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parityStable } from '../parity.js';
import { cleanup } from '../permissions/fixtures.js';
import {
	ACCEPTED,
	adminJwt,
	createGraphqlModel,
	createGraphqlUsers,
	fieldsByName,
	gql,
	gqlRequest,
	type GraphqlModel,
	type GraphqlUsers,
	sameGql,
	seedGraphqlModel,
	warnLines,
} from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);

let m: GraphqlModel;
let users: GraphqlUsers;
let admin: string;

const data = (captured: { json: unknown }) => (captured.json as any)?.data;

beforeAll(async () => {
	m = await createGraphqlModel(`gql_sys_${run}`);
	await seedGraphqlModel(m);
	users = await createGraphqlUsers(m, `gql-sys-${run}`);
	admin = await adminJwt();
}, 300_000);

afterAll(async () => {
	await cleanupFixtures();
	await cleanup();
	await closeHostDb();
}, 300_000);

describe('system collections and the data model (US3.1)', () => {
	it('users, roles, files, activity, the data model queries as the admin, user A and the public', async () => {
		for (const token of [admin, users.a.token, null]) {
			await sameGql('system', `{ users(filter: { email: { _eq: "${users.a.email}" } }) { id email role { name } } }`, {
				token,
			});
			await sameGql(
				'system',
				`{ roles(filter: { name: { _starts_with: "gql-sys-${run}" } }, sort: ["name"]) { name } }`,
				{
					token,
				},
			);
			await sameGql('system', `{ files(limit: 1, sort: ["id"]) { id type } }`, { token });
			await sameGql(
				'system',
				`{ activity(filter: { collection: { _eq: "${m.articles}" } }, sort: ["id"], limit: 3) { action collection item } }`,
				{ token },
			);
			await sameGql('system', `{ collections_by_name(name: "${m.articles}") { collection meta { singleton } } }`, {
				token,
			});
			await sameGql(
				'system',
				`{ fields_in_collection(collection: "${m.articles}") { field type schema { is_primary_key } } }`,
				{
					token,
					normalize: fieldsByName,
				},
			);
			await sameGql('system', `{ fields_by_name(collection: "${m.articles}", field: "title") { field type } }`, {
				token,
			});
			await sameGql(
				'system',
				`{ relations_in_collection(collection: "${m.comments}") { collection field related_collection } }`,
				{ token },
			);
		}
	});

	it('activity and revisions have no mutation; the deny list has no item type', async () => {
		await sameGql('system', `mutation { delete_activity_item(id: "1") { id } }`, { token: admin });
		await sameGql('system', `{ sessions { token } }`, { token: admin });
		await sameGql('system', `{ migrations { version } }`, { token: admin });
	});
});

describe('server, me, extensions, utils (US3.5, US3.6)', () => {
	it('server_ping, server_info, server_health, server_specs_graphql; users_me; extensions', async () => {
		for (const token of [admin, users.a.token, null]) {
			await sameGql('system', `{ server_ping }`, { token });
			await sameGql('system', `{ server_info { project { project_name default_language } } }`, { token });
			await sameGql('system', `{ server_specs_graphql(scope: system) }`, { token });
			await sameGql('system', `{ users_me { email } }`, { token });
		}

		// The status depends on the response time of each check (*_HEALTHCHECK_THRESHOLD): asked again until both answers
		// settle, like GET /server/health in src/server/health.test.ts.
		assertParity(await parityStable(gqlRequest('system', '{ server_health }'), { accepted: ACCEPTED }));
		await sameGql('system', `{ extensions { name bundle schema { type } meta { enabled } } }`, { token: admin });
		await sameGql('system', `{ extensions { name } }`, { token: users.a.token });

		// OpenAPI: same paths and schemas; the version is a hash of the request time (normalizeOas of feature 001).
		const oas = await Promise.all(
			(['directus', 'backoffice'] as const).map((app) => gql(app, 'system', '{ server_specs_oas }', { token: admin })),
		);
		expect(oas.map((c) => c.status)).toEqual([200, 200]);
		expect(Object.keys(data(oas[1]!).server_specs_oas.paths)).toEqual(
			Object.keys(data(oas[0]!).server_specs_oas.paths),
		);
	});

	it('utils: random string, hash generated at one app verified at the other, sort, revert, cache clear', async () => {
		for (const app of ['directus', 'backoffice'] as const) {
			const random = data(await gql(app, 'system', 'mutation { utils_random_string(length: 12) }', { token: admin }));
			expect(random.utils_random_string).toMatch(/^[\w-]{12}$/);
		}

		const hash = data(
			await gql('directus', 'system', 'mutation { utils_hash_generate(string: "graphql") }', { token: admin }),
		).utils_hash_generate as string;

		const verified = await gql(
			'backoffice',
			'system',
			`mutation { utils_hash_verify(string: "graphql", hash: "${hash}") }`,
			{
				token: admin,
			},
		);
		expect(data(verified).utils_hash_verify).toBe(true);

		await sameGql('system', `mutation { utils_hash_verify(string: "x", hash: "nope") }`, { token: admin });
		await sameGql('system', `mutation { utils_sort(collection: "${m.articles}", item: "1", to: "2") }`, {
			token: admin,
		});
		await sameGql('system', `mutation { utils_revert(revision: "999999999") }`, { token: admin });
		await sameGql('system', `mutation { utils_cache_clear }`, { token: users.a.token });
		await sameGql('system', `mutation { utils_cache_clear }`, { token: admin });
	});

	it('update_extensions_item is refused at the new app (D-37)', async () => {
		const result = await gql(
			'backoffice',
			'system',
			`mutation { update_extensions_item(id: "x", data: { meta: { enabled: false } }) { name } }`,
			{
				token: admin,
			},
		);

		expect(result.status).toBe(200);
		expect((result.json as any).errors[0].extensions.code).toBe('FORBIDDEN');
	});
});

describe('authentication (US3.2, FR-032)', () => {
	it('auth_login in json, cookie and session modes; refresh; logout; the token works at the other app', async () => {
		const byApp = await createUserPerApp(`gql-auth-${run}`);

		for (const app of ['directus', 'backoffice'] as const) {
			const user = byApp[app];

			for (const mode of ['json', 'cookie', 'session']) {
				const login = await gql(
					app,
					'system',
					`mutation { auth_login(email: "${user.email}", password: "${PASSWORD}", mode: ${mode}) { access_token refresh_token expires } }`,
				);

				expect(login.status).toBe(200);
				const tokens = data(login).auth_login;
				expect(Object.keys(tokens)).toEqual(['access_token', 'refresh_token', 'expires']);
				expect(typeof tokens.expires).toBe('string');
				if (mode === 'json') expect(tokens.refresh_token).toMatch(/^[\w-]{64}$/);
				if (mode !== 'json') expect(login.headers['set-cookie']).toBeDefined();
				if (mode === 'session') expect(tokens.access_token).toBeNull();

				if (mode === 'json') {
					const other = app === 'directus' ? 'backoffice' : 'directus';
					// A user without a role may not read directus_users (no users_me in its schema): the global TFA mutation
					// proves the token instead (it only returns a new secret, nothing is stored).
					const tfa = await gql(
						other,
						'system',
						`mutation { users_me_tfa_generate(password: "${PASSWORD}") { secret } }`,
						{
							token: tokens.access_token,
						},
					);
					expect(data(tfa).users_me_tfa_generate.secret).toMatch(/^[A-Z2-7]+$/);

					const refreshed = await gql(
						app,
						'system',
						`mutation { auth_refresh(refresh_token: "${tokens.refresh_token}", mode: json) { access_token refresh_token expires } }`,
					);
					expect(data(refreshed).auth_refresh.refresh_token).toMatch(/^[\w-]{64}$/);

					const logout = await gql(
						app,
						'system',
						`mutation { auth_logout(refresh_token: "${data(refreshed).auth_refresh.refresh_token}") }`,
					);
					expect(data(logout).auth_logout).toBe(true);
				}
			}
		}

		// Wrong credentials, a wrong mode, a missing refresh token: same errors at both apps.
		await sameGql(
			'system',
			`mutation { auth_login(email: "${byApp.directus.email}", password: "wrong") { access_token } }`,
		);
		await sameGql('system', `mutation { auth_login(email: "x", password: "y", mode: other) { access_token } }`);
		await sameGql('system', `mutation { auth_refresh(refresh_token: "${'x'.repeat(64)}") { access_token } }`);
		await sameGql('system', `mutation { auth_logout(refresh_token: "${'x'.repeat(64)}") }`);
	});

	it('a user with TFA: no OTP and a wrong OTP are refused, the right OTP logs in', async () => {
		const secret = 'JBSWY3DPEHPK3PXP';
		const user = await createAuthUser(`gql-tfa-${run}`, { tfa_secret: secret });
		const login = (otp?: string) =>
			`mutation { auth_login(email: "${user.email}", password: "${PASSWORD}"${otp ? `, otp: "${otp}"` : ''}) { expires } }`;

		await sameGql('system', login());
		await sameGql('system', login('000000'));

		for (const app of ['directus', 'backoffice'] as const) {
			const ok = await gql(app, 'system', login(totp(secret)));
			expect(data(ok).auth_login.expires).toMatch(/^\d+$/);
		}
	});

	it('password request, invitation, registration: same answers; a warning line instead of each mail', async () => {
		const target = await createAuthUser(`gql-reset-${run}`);
		const needle = 'Backoffice does not send email';

		for (const app of ['directus', 'backoffice'] as const) {
			const before = warnLines('backoffice-api', needle);

			const reset = await gql(app, 'system', `mutation { auth_password_request(email: "${target.email}") }`);
			const invite = await gql(
				app,
				'system',
				`mutation { users_invite(email: "gql-inv-${app}-${run}@example.com", role: "${(await appRequest('directus', 'GET', `/users/${users.a.id}?fields=role`)).data.role}") }`,
				{
					token: admin,
				},
			);

			expect([reset.status, invite.status]).toEqual([200, 200]);
			expect(data(reset)).toEqual({ auth_password_request: true });
			expect(data(invite)).toEqual({ users_invite: true });
			expect(warnLines('backoffice-api', needle) - before).toBe(app === 'backoffice' ? 2 : 0);
		}

		await hostDb()('directus_users').where('email', 'like', `gql-inv-%-${run}@example.com`).delete();
	});
});

describe('the data model through GraphQL (US3.4, FR-034)', () => {
	it('a field created at one app is seen at the other; deleted again', async () => {
		for (const [writer, reader] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const field = `gql_f_${writer}`;

			const created = await gql(
				writer,
				'system',
				`mutation { create_fields_item(collection: "${m.tags}", data: { field: "${field}", type: "string" }) { field type } }`,
				{ token: admin },
			);
			expect(data(created).create_fields_item).toEqual({ field, type: 'string' });

			const seen = await gql(
				reader,
				'system',
				`{ fields_by_name(collection: "${m.tags}", field: "${field}") { field } }`,
				{
					token: admin,
				},
			);
			expect(data(seen).fields_by_name).toEqual({ field });

			// The GraphQL schema of the other app follows (its cache is cleared through the bus).
			const typed = await gql(reader, 'items', `{ ${m.tags}(limit: 1) { ${field} } }`, { token: admin });
			expect(typed.status).toBe(200);

			const deleted = await gql(
				writer,
				'system',
				`mutation { delete_fields_item(collection: "${m.tags}", field: "${field}") { collection field } }`,
				{ token: admin },
			);
			expect(data(deleted).delete_fields_item).toEqual({ collection: m.tags, field });
		}
	});
});

describe('system services behind the mutations (FR-025)', () => {
	it('shares without the share permission, duplicate translations, users with a password', async () => {
		await sameGql(
			'system',
			`mutation { create_shares_item(data: { collection: "${m.articles}", item: "1" }) { id } }`,
			{
				token: users.a.token,
			},
		);

		const key = `gql_tr_${run}`;
		await appRequest('directus', 'POST', '/translations', { key, language: 'en-US', value: 'one' });
		await sameGql(
			'system',
			`mutation { create_translations_item(data: { key: "${key}", language: "en-US", value: "two" }) { id } }`,
			{
				token: admin,
			},
		);
		await hostDb()('directus_translations').where({ key }).delete();

		for (const [writer, reader] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const email = `gql-pw-${writer}-${run}@example.com`;
			await gql(
				writer,
				'system',
				`mutation { create_users_item(data: { email: "${email}", password: "${PASSWORD}", status: "active" }) { id } }`,
				{
					token: admin,
				},
			);

			const login = await gql(
				reader,
				'system',
				`mutation { auth_login(email: "${email}", password: "${PASSWORD}") { expires } }`,
			);
			expect(data(login).auth_login.expires).toMatch(/^\d+$/);
			expect((await hostDb()('directus_users').where({ email }).first()).password).toMatch(/^\$argon2/);
		}

		await hostDb()('directus_sessions')
			.whereIn('user', hostDb()('directus_users').select('id').where('email', 'like', `gql-pw-%-${run}@example.com`))
			.delete();
		await hostDb()('directus_users').where('email', 'like', `gql-pw-%-${run}@example.com`).delete();
	});
});
