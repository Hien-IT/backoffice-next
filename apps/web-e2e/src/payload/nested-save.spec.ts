// Feature 016 T004 (research R6, CHK097): the role and policy pages save relational edits nested in one PATCH, as the
// Directus app does (`permissions`, `roles`, `policies`, `users` as `{ create, update, delete }`). The same calls go to
// Directus 11.17.4 and to the new API, one app after the other on the shared database, and the rows they write must be
// the same. Kept as a regression test of the API engine (004). proxy-api only.
import { expect, test } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { directusUrl, e2eConfig } from '../helpers/config.js';
import { changesSince, closeHostDb, snapshot } from '../helpers/db-rows.js';

test.skip(e2eConfig !== 'proxy-api', 'nested save comparison runs in proxy-api only');

const API_URL = process.env['BACKOFFICE_API_URL'] ?? 'http://127.0.0.1:8156';
const NAME = 'bo_t004_nested';

async function cleanup(api: AdminApi): Promise<void> {
	const policies = await api.call<{ id: string }[]>('GET', `/policies?fields=id&filter[name][_eq]=${NAME}&limit=-1`);
	if (policies.length) await api.call('DELETE', '/policies', { data: policies.map((p) => p.id) });
	const roles = await api.call<{ id: string }[]>('GET', `/roles?fields=id&filter[name][_eq]=${NAME}&limit=-1`);
	if (roles.length) await api.call('DELETE', '/roles', { data: roles.map((r) => r.id) });
}

/** Creates a role and a policy, then saves nested edits on both the way the Settings pages do; returns the DB changes. */
async function run(api: AdminApi): Promise<unknown> {
	await cleanup(api);
	const role = await api.call<{ id: string }>('POST', '/roles', { data: { name: NAME } });
	const policy = await api.call<{ id: string }>('POST', '/policies', {
		data: { name: NAME, app_access: true, admin_access: false },
	});
	const before = await snapshot();

	// Policy page: the permissions matrix and the roles list in one PATCH (policies/item.vue).
	await api.call('PATCH', `/policies/${policy.id}`, {
		data: {
			permissions: {
				create: [
					{ collection: 'bo_std', action: 'read', fields: ['*'], permissions: null, validation: null, presets: null },
					{
						collection: 'bo_std',
						action: 'create',
						fields: ['title'],
						permissions: null,
						validation: { _and: [{ title: { _nnull: true } }] },
						presets: { title: 'draft' },
					},
				],
				update: [],
				delete: [],
			},
			roles: { create: [{ role: role.id }], update: [], delete: [] },
		},
	});

	const permissions = await api.call<{ id: number; action: string }[]>(
		'GET',
		`/permissions?fields=id,action&filter[policy][_eq]=${policy.id}&sort=action`,
	);
	const create = permissions.find((p) => p.action === 'create')!;
	const read = permissions.find((p) => p.action === 'read')!;

	// Second save: update one permission, delete the other (the matrix after "use custom" and "no access").
	await api.call('PATCH', `/policies/${policy.id}`, {
		data: {
			permissions: { create: [], update: [{ id: create.id, fields: ['title', 'id'] }], delete: [read.id] },
		},
	});

	// Role page: unassign the policy from the role (roles/item.vue, list-m2m of directus_access).
	const access = await api.call<{ id: string }[]>('GET', `/access?fields=id&filter[role][_eq]=${role.id}`);
	await api.call('PATCH', `/roles/${role.id}`, {
		data: { policies: { create: [], update: [], delete: access.map((a) => a.id) } },
	});

	const changes = await changesSince(before);
	await cleanup(api);
	return changes;
}

test('nested saves of the role and policy pages write the same rows as Directus', async ({ playwright }) => {
	const context = await playwright.request.newContext();

	try {
		const directus = await run(new AdminApi(context, directusUrl));
		const backoffice = await run(new AdminApi(context, API_URL));
		// Net effect of the scenario: the create permission stays (updated), the read one is gone, the role link is gone.
		expect((directus as { directus_permissions: { added: unknown[] } }).directus_permissions.added).toHaveLength(1);
		expect(backoffice).toEqual(directus);
	} finally {
		await context.dispose();
		await closeHostDb();
	}
});
