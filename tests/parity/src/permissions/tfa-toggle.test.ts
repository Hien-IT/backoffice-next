// Feature 004, FR-048: enabling and disabling TFA (D-09.10 of spec 003 removed). A secret generated at one app is
// enabled at the other, both ways; the errors and the permission on tfa_secret behave like Directus.
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario, send } from '../auth/scenario.js';
import { totp } from '../auth/tokens.js';
import { appUrl } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser, uniqueName } from './fixtures.js';
import { startFlow } from './flow.js';

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 60_000);

/** A role whose users may update their own row (tfa_secret included) and read it. */
async function selfUpdateRole(name: string): Promise<string> {
	const { leaf } = await createRoleTree('directus', name);
	const own = { id: { _eq: '$CURRENT_USER' } };

	const policy = await createPolicy('directus', name, {
		app: true,
		permissions: [
			{ collection: 'directus_users', action: 'read', fields: ['*'], permissions: own },
			{ collection: 'directus_users', action: 'update', fields: ['*'], permissions: own },
		],
	});

	await attachPolicy('directus', policy, { role: leaf });
	return leaf;
}

describe('FR-048: enable and disable TFA', () => {
	it('a secret generated at the other app is enabled here; errors; disable with the OTP', async () => {
		const prefix = uniqueName('parity-tfa-toggle');
		const role = await selfUpdateRole(prefix);

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const user = await createUser('directus', `${prefix}-${ctx.app}`, { role });
			flow.name(user.id, 'user');
			const headers = { authorization: `Bearer ${user.token}` };
			const other = ctx.app === 'directus' ? 'backoffice' : 'directus';

			const generated = await send(
				appUrl(other),
				{ method: 'POST', path: '/users/me/tfa/generate', body: { password: user.password }, headers },
				ctx.host,
			);

			const secret = (generated.json as any).data.secret as string;
			flow.name(secret, 'secret');
			flow.name(user.email, 'email');
			const otp = await totp(secret);
			flow.nameExact(otp, 'otp');

			await flow.req('POST', '/users/me/tfa/disable', { otp: '000000' }, headers);
			await flow.req('POST', '/users/me/tfa/enable', { otp: '000000' }, headers);
			await flow.req('POST', '/users/me/tfa/enable', { secret }, headers);
			await flow.req('POST', '/users/me/tfa/enable', { secret, otp: '000000' }, headers);
			await flow.req('POST', '/users/me/tfa/enable', { secret, otp }, headers);
			await flow.req('POST', '/users/me/tfa/enable', { secret, otp }, headers);
			await flow.rows('directus_users', (q) => q.where({ id: user.id }), { columns: ['tfa_secret'] });
			await flow.req('POST', '/users/me/tfa/disable', {}, headers);
			await flow.req('POST', '/users/me/tfa/disable', { otp: '000000' }, headers);
			await flow.req('POST', '/users/me/tfa/disable', { otp }, headers);
			await flow.rows('directus_users', (q) => q.where({ id: user.id }), { columns: ['tfa_secret'] });
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'tfa toggle');
	});

	it('without update permission on tfa_secret: 403; /users/:pk/tfa/disable needs an admin', async () => {
		const prefix = uniqueName('parity-tfa-forbidden');
		const { leaf } = await createRoleTree('directus', prefix);
		await attachPolicy('directus', await createPolicy('directus', prefix, { app: true }), { role: leaf });

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const user = await createUser('directus', `${prefix}-${ctx.app}`, { role: leaf });
			flow.name(user.id, 'user');
			const headers = { authorization: `Bearer ${user.token}` };

			const generated = await flow.req('POST', '/users/me/tfa/generate', { password: user.password }, headers);
			const secret = (generated.json as any).data.secret as string;
			flow.name(secret, 'secret');
			flow.name(user.email, 'email');
			flow.name(encodeURIComponent(user.email), 'email');
			const otp = await totp(secret);
			flow.nameExact(otp, 'otp');

			await flow.req('POST', '/users/me/tfa/enable', { secret, otp }, headers);
			await flow.req('POST', `/users/${user.id}/tfa/disable`, {}, headers);
			await flow.req('POST', `/users/${user.id}/tfa/disable`, {});
			await flow.rows('directus_users', (q) => q.where({ id: user.id }), { columns: ['tfa_secret'] });
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'tfa forbidden');
		expect((transcripts.backoffice as any[])[1].response.status).toBe(403);
	});
});
