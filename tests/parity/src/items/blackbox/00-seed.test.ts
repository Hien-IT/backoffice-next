// Backoffice: replaces directus/tests/blackbox/tests/db/seed-database.test.ts, setup/seeds/02_tests_flow.js and the
// createRole(), createUser() cases of common/common.test.ts (feature 005, research R6). Through the Directus of the
// blackbox pair: the tests flow role, policy and user, the roles and users of common/variables.ts with their static
// tokens (kept when they exist), then the structure of every seed file (each one deletes and recreates its collections).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getSetupUrl } from './common/config';
import { CreatePolicy, CreateRole, CreateUser } from './common/functions';
import vendors from './common/get-dbs-to-test';
import { ROLE, TEST_USERS, USER } from './common/variables';
import * as caseWhen from './tests/db/routes/items/case-when.seed';
import * as concealFilter from './tests/db/routes/items/conceal-filter.seed';
import * as hashFilter from './tests/db/routes/items/hash-filter.seed';
import * as jsonFields from './tests/db/routes/items/json-fields.seed';
import * as m2a from './tests/db/routes/items/m2a.seed';
import * as m2m from './tests/db/routes/items/m2m.seed';
import * as m2o from './tests/db/routes/items/m2o.seed';
import * as noRelation from './tests/db/routes/items/no-relation.seed';
import * as o2m from './tests/db/routes/items/o2m.seed';
import * as relationalJson from './tests/db/routes/items/relational-json.seed';
import * as singleton from './tests/db/routes/items/singleton.seed';

const TESTS_FLOW_POLICY = '9cd8b17c-474b-4abb-b366-09dcdb45e177';
const TESTS_FLOW_ACCESS = '27029bb1-8b2e-43c2-b966-eb049f84ea68';

const filter = (value: object) => `${encodeURIComponent(JSON.stringify(value))}&fields=id`;

async function adminRequest() {
	const login = await request(getSetupUrl())
		.post('/auth/login')
		.send({ email: 'admin@example.com', password: 'password' });

	const token = login.body.data.access_token as string;

	return (method: 'get' | 'post' | 'delete', path: string, body?: object) => {
		const req = request(getSetupUrl())[method](path).set('Authorization', `Bearer ${token}`);
		return body ? req.send(body) : req;
	};
}

describe('Seed users', () => {
	it.each(vendors)(
		'%s',
		async (vendor) => {
			const api = await adminRequest();

			// setup/seeds/02_tests_flow.js: the admin that every helper of common/functions.ts acts as.
			if ((await api('get', `/roles/${ROLE.TESTS_FLOW.ID}`)).status !== 200) {
				await api('post', '/roles', { id: ROLE.TESTS_FLOW.ID, name: ROLE.TESTS_FLOW.NAME });
			}

			if ((await api('get', `/policies/${TESTS_FLOW_POLICY}`)).status !== 200) {
				await api('post', '/policies', {
					id: TESTS_FLOW_POLICY,
					name: 'Tests Flow Policy',
					admin_access: true,
					app_access: true,
				});
			}

			if ((await api('get', `/access/${TESTS_FLOW_ACCESS}`)).status !== 200) {
				await api('post', '/access', { id: TESTS_FLOW_ACCESS, role: ROLE.TESTS_FLOW.ID, policy: TESTS_FLOW_POLICY });
			}

			if ((await api('get', `/users/${USER.TESTS_FLOW.ID}`)).status !== 200) {
				await api('post', '/users', {
					id: USER.TESTS_FLOW.ID,
					email: USER.TESTS_FLOW.EMAIL,
					password: USER.TESTS_FLOW.PASSWORD,
					status: 'active',
					role: ROLE.TESTS_FLOW.ID,
					token: USER.TESTS_FLOW.TOKEN,
				});
			}

			// common/common.test.ts createRole() and createUser().
			for (const [key, admin, app] of [
				['ADMIN', true, true],
				['APP_ACCESS', false, true],
				['API_ONLY', false, false],
			] as const) {
				const role = await CreateRole(vendor, { name: ROLE[key].NAME });

				await CreatePolicy(vendor, {
					name: `${ROLE[key].NAME}'s Policy`,
					adminAccessEnabled: admin,
					appAccessEnabled: app,
					role,
				});
			}

			for (const key of TEST_USERS) {
				const existing = await api('get', `/users?filter=${filter({ email: { _eq: USER[key].EMAIL } })}`);
				if (existing.body.data.length > 0) continue;

				await CreateUser(vendor, {
					token: USER[key].TOKEN,
					email: USER[key].EMAIL,
					password: USER[key].PASSWORD,
					name: USER[key].NAME,
					...(key === 'NO_ROLE' ? {} : { roleName: ROLE[key].NAME }),
				});
			}

			// Backoffice: directus/tests/blackbox starts from a fresh database, the parity port runs twice on one database. The
			// user (fixed static token, so creating it twice fails) and the policy that case-when.test.ts creates are removed
			// so each run creates them again; `token` is concealed and cannot be filtered on, `first_name` is. Its items
			// reference the user (user_created), so the collection goes first; case-when.seed.ts makes it again below.
			await api('delete', `/collections/${caseWhen.collection}`);
			const caseWhenUsers = await api(
				'get',
				`/users?filter=${filter({ first_name: { _eq: `${caseWhen.collection} user` } })}`,
			);
			for (const { id } of caseWhenUsers.body.data) expect((await api('delete', `/users/${id}`)).status).toBe(204);

			const caseWhenPolicies = await api(
				'get',
				`/policies?filter=${filter({ name: { _eq: `${caseWhen.collection} policy` } })}`,
			);
			for (const { id } of caseWhenPolicies.body.data)
				expect((await api('delete', `/policies/${id}`)).status).toBe(204);

			const users = await api('get', `/users?filter[token][_nnull]=true&fields=email&limit=-1`);
			expect(users.status).toBe(200);
		},
		120_000,
	);
});

describe('Seed database structure', () => {
	for (const [name, seed] of [
		['case-when', caseWhen],
		['conceal-filter', concealFilter],
		['hash-filter', hashFilter],
		['json-fields', jsonFields],
		['m2a', m2a],
		['m2m', m2m],
		['m2o', m2o],
		['no-relation', noRelation],
		['o2m', o2m],
		['relational-json', relationalJson],
		['singleton', singleton],
	] as const) {
		describe(`Seeding "${name}.seed.ts"`, () => {
			if ('seedDBStructure' in seed) seed.seedDBStructure();
		});
	}
});
