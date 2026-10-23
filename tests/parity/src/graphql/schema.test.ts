// Feature 011, US4 (spec FR-040 to FR-047, SC-001, SC-005, SC-006, contracts/parity.md §2): the schema each user gets.
// Introspection and the SDL of both scopes are compared verbatim, order included (Clarifications), for the admin, the
// users A, B, C of helpers.ts, a share token and the public with and without a policy. The schema cache of each app
// is cleared through the shared bus: a change at one app shows at the other. The graphql-nointro pair holds the
// limits read at start-up (introspection off, a 50-token document limit, a two-entry cache, one generation at a time).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acceptedDifferences } from '../../accepted-differences.js';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { appRequest, appUrl } from '../directus-api.js';
import { assertParity, capture, parity } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	CreateRole,
	createField,
	createPolicy,
	createShare,
	createUserCollection,
	uniqueName,
} from '../permissions/fixtures.js';
import { profileUrls } from '../profiles.js';
import {
	ACCEPTED,
	adminJwt,
	createGraphqlModel,
	createGraphqlUsers,
	gql,
	type GraphqlModel,
	type GraphqlUsers,
	INTROSPECTION,
	introspection,
	sameGql,
	type Scope,
	sdlByField,
	seedGraphqlModel,
	warnLines,
} from './helpers.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const run = Math.random().toString(16).slice(2, 8);
const SCOPES: Scope[] = ['items', 'system'];

let m: GraphqlModel;
let users: GraphqlUsers;
let admin: string;
let articles: number[];

beforeAll(async () => {
	m = await createGraphqlModel(`gql_schema_${run}`);
	({ articles } = await seedGraphqlModel(m));
	users = await createGraphqlUsers(m, `gql-schema-${run}`);
	admin = await adminJwt();
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

/** The SDL route at both apps, compared like any route (status, body, headers; D-15 left out until the feature closes). */
async function sameSdl(scope: Scope, token: string | null) {
	const result = await parity(
		{
			path: scope === 'system' ? '/server/specs/graphql/system' : '/server/specs/graphql',
			headers: token ? { authorization: `Bearer ${token}` } : {},
			normalize: sdlByField,
		},
		{ accepted: ACCEPTED },
	);

	assertParity(result);
	return result;
}

/** Polls `check` at `app` until it holds (the bus delivers schemaChanged in a few milliseconds; give it 5 s). */
async function eventually(check: () => Promise<boolean>) {
	for (let i = 0; i < 50; i++) {
		if (await check()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	throw new Error('the schema did not change in 5 s');
}

const fieldsOf = async (app: 'directus' | 'backoffice', type: string, token: string) =>
	(
		(await gql(app, 'items', `{ __type(name: "${type}") { fields { name } } }`, { token })).json as any
	).data.__type?.fields?.map((f: { name: string }) => f.name) ?? [];

describe('introspection and SDL per user (US4.1, US4.2, SC-001)', () => {
	it('the admin and users A, B, C: both scopes, verbatim', async () => {
		const tokens = [admin, users.a.token, ...(suite === 'reduced' ? [] : [users.b.token, users.c.token])];

		for (const token of tokens) {
			for (const scope of SCOPES) {
				await sameGql(scope, INTROSPECTION, { token });
				await sameSdl(scope, token);
			}
		}
	});

	it.runIf(suite === 'full')('a share token (the schema of the share role, FR-040)', async () => {
		const role = await CreateRole('directus', { name: uniqueName(`gql-schema-share-${run}`) });
		const policy = await createPolicy('directus', `gql-schema-share-${run}`, {
			permissions: [{ collection: m.articles, action: 'read', fields: ['id', 'title'] }],
		});
		await attachPolicy('directus', policy, { role: role.id });

		const share = await createShare(m.articles, articles[0]!, { role: role.id });
		const login = await capture(appUrl('directus'), { method: 'POST', path: '/shares/auth', body: { share } });
		const token = (login.json as any).data.access_token as string;

		for (const scope of SCOPES) await sameGql(scope, INTROSPECTION, { token });
	});

	it.runIf(suite === 'full')(
		'the public without a policy of its own, then with one that reads a collection',
		async () => {
			for (const scope of SCOPES) {
				await sameGql(scope, INTROSPECTION);
				await sameSdl(scope, null);
			}

			const policy = await createPolicy('directus', `gql-schema-public-${run}`, {
				permissions: [{ collection: m.categories, action: 'read', fields: ['id', 'name'] }],
			});

			const access = await attachPolicy('directus', policy, { role: null, user: null });

			try {
				await eventually(async () => (await fieldsOf('backoffice', m.categories, '')).length > 0);

				for (const scope of SCOPES) {
					await sameGql(scope, INTROSPECTION);
					await sameSdl(scope, null);
				}
			} finally {
				await appRequest('directus', 'DELETE', `/access/${access}`);
			}
		},
	);
});

describe('the schema follows changes at the other app (US4.4, SC-005)', () => {
	it('a field made at Directus is in the schema of the new app, and the other way round', async () => {
		await fieldsOf('backoffice', m.tags, admin);
		await fieldsOf('directus', m.tags, admin);

		await createField(m.tags, { field: 'from_directus', type: 'string' });
		await eventually(async () => (await fieldsOf('backoffice', m.tags, admin)).includes('from_directus'));

		await appRequest('backoffice', 'POST', `/fields/${m.tags}`, { field: 'from_backoffice', type: 'string' });
		await eventually(async () => (await fieldsOf('directus', m.tags, admin)).includes('from_backoffice'));

		await appRequest('backoffice', 'DELETE', `/fields/${m.tags}/from_backoffice`);
		await eventually(async () => !(await fieldsOf('directus', m.tags, admin)).includes('from_backoffice'));

		await sameGql('items', INTROSPECTION, { token: admin });
	});

	it('a permission changed at the new app changes the schema of the user at Directus', async () => {
		const token = users.a.token;
		expect(await fieldsOf('directus', m.articles, token)).not.toContain('rating');

		const permission = await appRequest('backoffice', 'POST', '/permissions', {
			policy: users.policies.a,
			collection: m.tags,
			action: 'read',
			fields: ['*'],
		});

		try {
			await eventually(async () => (await fieldsOf('directus', m.tags, token)).includes('label'));
			await sameGql('items', INTROSPECTION, { token });
		} finally {
			await appRequest('backoffice', 'DELETE', `/permissions/${permission.data.id}`);
		}
	});

	it.runIf(suite === 'full')(
		'R-30: a permission written straight to the database is not seen until the cache is cleared',
		async () => {
			const token = users.c.token;
			const before = await fieldsOf('backoffice', m.comments, token);
			expect(before).toEqual([]);

			const policy = users.policies.c;

			// No RETURNING (MySQL, SQLite): the row is found again by its policy and collection.
			await hostDb()('directus_permissions').insert({ policy, collection: m.comments, action: 'read', fields: '*' });

			try {
				// Both apps keep the schema of user C until something clears the system cache (Directus does the same).
				for (const app of ['directus', 'backoffice'] as const)
					expect(await fieldsOf(app, m.comments, token)).toEqual([]);

				await appRequest('directus', 'POST', '/utils/cache/clear?system');
				await eventually(async () => (await fieldsOf('backoffice', m.comments, token)).length > 0);
			} finally {
				await hostDb()('directus_permissions').where({ policy, collection: m.comments }).delete();
				await appRequest('directus', 'POST', '/utils/cache/clear?system');
			}
		},
	);
});

describe('names GraphQL cannot use (US4.6, FR-046)', () => {
	it.runIf(suite === 'full')(
		'a collection named like a reserved type or a digit first is left out with a warning',
		async () => {
			const bad = `9gql_bad_${run}`;
			const warning = `GraphQL skipping collection "${bad}"`;
			const before = warnLines('backoffice-api', warning);

			await createUserCollection(bad, [{ field: 'name', type: 'string' }]);
			await sameGql('items', INTROSPECTION, { token: admin });

			expect(warnLines('backoffice-api', warning)).toBeGreaterThan(before);
		},
	);

	it.runIf(suite === 'full')(
		'a field named __x on a valid collection breaks the schema at both apps alike',
		async () => {
			// Made and dropped here, not by cleanup(): while it exists every schema of the items scope fails to build.
			const collection = `gql_dunder_${run}`;
			await appRequest('directus', 'POST', '/collections', {
				collection,
				schema: {},
				meta: { hidden: true },
				fields: [
					{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true } },
					{ field: '__x', type: 'string' },
				],
			});

			try {
				await sameGql('items', `{ __typename }`, { token: admin });
			} finally {
				await appRequest('directus', 'DELETE', `/collections/${collection}`);
			}
		},
	);
});

describe('limits read at start-up (profile graphql-nointro, US4.3, US5.4, SC-006)', () => {
	const urls = () => profileUrls('graphql-nointro')!;
	const accepted = acceptedDifferences;

	it.runIf(suite === 'full' && Boolean(profileUrls('graphql-nointro')))(
		'GRAPHQL_INTROSPECTION=false: introspection refused, no SDL route; a document over 50 tokens refused',
		async () => {
			for (const req of [
				{ method: 'POST', path: '/graphql', body: { query: '{ __schema { queryType { name } } }' } },
				{ method: 'POST', path: '/graphql/system', body: { query: '{ __type(name: "Query") { name } }' } },
				{ path: '/server/specs/graphql' },
				{ method: 'OPTIONS', path: '/server/specs/graphql' },
				{ method: 'POST', path: '/graphql/system', body: { query: `{ ${'server_ping '.repeat(60)}}` } },
				{ method: 'POST', path: '/graphql/system', body: { query: '{ server_ping }' } },
			]) {
				const result = await parity({ ...req, headers: { authorization: `Bearer ${admin}` } }, { ...urls(), accepted });
				assertParity(result);
			}
		},
	);

	it.runIf(suite === 'full' && Boolean(profileUrls('graphql-nointro')))(
		'a two-entry schema cache and one generation at a time: ten users at once all get their own schema',
		async () => {
			const tokens = [admin, users.a.token, users.b.token, users.c.token];
			const query = `{ ${m.articles}(limit: 1, sort: ["id"]) { id } }`;

			for (const base of [urls().directusUrl!, urls().backofficeUrl!]) {
				const answers = await Promise.all(
					[...tokens, ...tokens, admin, users.a.token].map((token) =>
						capture(base, {
							method: 'POST',
							path: '/graphql',
							headers: { authorization: `Bearer ${token}` },
							body: { query },
						}),
					),
				);

				expect(answers.map((a) => a.status)).toEqual(Array(10).fill(200));
			}

			for (const token of tokens) {
				const result = await parity(
					{ method: 'POST', path: '/graphql', headers: { authorization: `Bearer ${token}` }, body: { query } },
					{ ...urls(), accepted },
				);
				assertParity(result);
			}
		},
	);
});

describe('the SDL route (US4.5)', () => {
	it('an unknown scope, HEAD and OPTIONS', async () => {
		for (const req of [
			{ path: '/server/specs/graphql/nope', headers: { authorization: `Bearer ${admin}` } },
			{ method: 'HEAD', path: '/server/specs/graphql', headers: { authorization: `Bearer ${admin}` } },
			{ method: 'OPTIONS', path: '/server/specs/graphql/system' },
		]) {
			const result = await parity(req, { accepted: ACCEPTED });
			assertParity(result);
		}

		expect((await introspection('backoffice', 'system', admin)).data).toBeDefined();
	});
});
