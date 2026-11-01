// Ported from directus/api/src/permissions/modules/fetch-accountability-policy-globals/fetch-accountability-policy-globals.ts
import type { Accountability, Globals } from '@backoffice/types';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';

export async function fetchAccountabilityPolicyGlobals(
	accountability: Pick<Accountability, 'user' | 'roles' | 'ip' | 'admin' | 'app' | 'session'>,
	context: Context,
): Promise<Globals> {
	const policies = await fetchPolicies(accountability, context);

	// Policies are already filtered down by the accountability IP, so we don't need to check it again

	const result = await context.knex
		.select(1)
		.from('directus_policies')
		.whereIn('id', policies)
		.where('enforce_tfa', true)
		.first();

	// Backoffice (spec 029, D-207.5): a session a passkey login created already has two factors, so the app does not
	// ask for the TFA setup. Only session tokens carry `session`; JSON and static tokens keep the DR answer.
	if (result && accountability.session) {
		const session = await context.knex
			.select('bo_passkey')
			.from('directus_sessions')
			.where({ token: accountability.session })
			.first();

		if (session?.bo_passkey)
			return { app_access: accountability.app, admin_access: accountability.admin, enforce_tfa: false };
	}

	return {
		app_access: accountability.app,
		admin_access: accountability.admin,
		enforce_tfa: !!result,
	};
}
