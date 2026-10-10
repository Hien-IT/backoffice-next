// Ported from directus/api/src/permissions/lib/fetch-policies.ts. AccessService is replaced by the same reads with
// knex (research R16.4 of feature 001); feature 004 ports the full permissions module. Cached in the shared
// permissions cache like Directus (feature 002).
import type { Accountability } from '@backoffice/types';
import type { Context } from '../types.js';
import { castCsv } from '../../utils/cast-on-read.js';
import { filterPoliciesByIp } from '../utils/filter-policies-by-ip.js';
import { withCache } from '../utils/with-cache.js';

export interface AccessRow {
	policy: { id: string; ip_access: string[] | null };
	role: string | null;
}

export const fetchPolicies = withCache('policies', _fetchPolicies, ({ roles, user, ip }) => ({ roles, user, ip }));

/**
 * Fetch the policies associated with the current user accountability
 */
export async function _fetchPolicies(
	{ roles, user, ip }: Pick<Accountability, 'user' | 'roles' | 'ip'>,
	{ knex }: Context,
): Promise<string[]> {
	const query = knex.select('role', 'policy', 'id').from('directus_access');

	if (roles.length === 0) {
		// Users without role assumes the Public role permissions along with their attached policies
		query.where((q) => q.whereNull('role').whereNull('user'));
	} else {
		query.whereIn('role', roles);
	}

	// If the user is not null, we also want to include the policies attached to the user
	if (user) query.orWhere('user', user);

	// directus_access sorts by its `sort` field, like ItemsService.readByQuery without an explicit sort.
	const access: { role: string | null; policy: string }[] = await query.orderBy('sort');

	const policyIds = [...new Set(access.map((row) => row.policy).filter(Boolean))];

	const policies: { id: string; ip_access: unknown }[] = policyIds.length
		? await knex.select('id', 'ip_access').from('directus_policies').whereIn('id', policyIds)
		: [];

	const accessRows: AccessRow[] = access.map((row) => {
		const policy = policies.find((p) => p.id === row.policy);
		return {
			role: row.role,
			policy: { id: row.policy, ip_access: (castCsv(policy?.ip_access ?? null) as string[] | null) ?? null },
		};
	});

	const filteredAccessRows = filterPoliciesByIp(accessRows, ip);

	/*
	 * Sort rows by priority (goes bottom up):
	 * - Parent role policies
	 * - Child role policies
	 * - User policies
	 */
	filteredAccessRows.sort((a, b) => {
		if (!a.role && !b.role) return 0;
		if (!a.role) return 1;
		if (!b.role) return -1;

		return roles.indexOf(a.role) - roles.indexOf(b.role);
	});

	const ids = filteredAccessRows.map(({ policy }) => policy.id);

	return ids;
}
