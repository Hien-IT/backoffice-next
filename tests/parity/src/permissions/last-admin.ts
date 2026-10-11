// Feature 004, US3.3: the "last admin" cases try to remove the only admin access of the environment. Directus refuses
// them only while the bootstrap admin is the single active admin; with a leftover admin (an aborted run) the request
// would succeed and break the environment, so the tests check that state first and fail instead.
import { hostDb } from '../auth/db-effects.js';

export interface BootstrapAdmin {
	policy: string;
	access: string;
	role: string;
}

export async function onlyBootstrapAdmin(): Promise<BootstrapAdmin> {
	const db = hostDb();
	const policies = await db('directus_policies').where({ admin_access: true }).select('id');
	if (policies.length !== 1) throw new Error(`expected one admin policy, found ${policies.length}`);

	const access = await db('directus_access').where({ policy: policies[0].id }).select('id', 'role', 'user');
	if (access.length !== 1 || !access[0].role || access[0].user) throw new Error('expected one role access row');

	const children = await db('directus_roles').where({ parent: access[0].role }).count({ n: '*' }).first();
	const admins = await db('directus_users').where({ role: access[0].role, status: 'active' }).count({ n: '*' }).first();

	if (Number(children?.['n']) !== 0 || Number(admins?.['n']) !== 1) {
		throw new Error('expected the bootstrap admin to be the only active admin');
	}

	return { policy: policies[0].id, access: access[0].id, role: access[0].role };
}
