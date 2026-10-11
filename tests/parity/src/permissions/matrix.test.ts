// Feature 004, SC-001 (T058): the full permission matrix of FR-101, one shard per run (PARITY_MATRIX_SHARD="<i>/<n>",
// see matrix.ts), each fixture group a test; plus the cases of FR-035 and R-01 the product does not cover (US1.7 is
// in accountability.test.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { signAccessToken } from '../auth/tokens.js';
import { appRequest } from '../directus-api.js';
import { assertParity, parity } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser } from './fixtures.js';
import {
	buildGroup,
	type CellFailure,
	cleanupMatrix,
	MATRIX_IP,
	makeTargets,
	readCells,
	setupMatrixSchema,
	teardownMatrixSchema,
	writeCells,
} from './matrix-harness.js';
import { parseShard, shardGroups } from './matrix.js';

let ref: number;
const started = Date.now();

beforeAll(async () => {
	ref = await setupMatrixSchema();
}, 120_000);

afterAll(async () => {
	await cleanupMatrix();
	await cleanup();
	await teardownMatrixSchema();
	await closeHostDb();
	process.stdout.write(
		`matrix shard ${JSON.stringify(parseShard())}: ${((Date.now() - started) / 60_000).toFixed(1)} min\n`,
	);
}, 300_000);

describe(`permission matrix, shard ${process.env['PARITY_MATRIX_SHARD'] ?? '1/1'}`, () => {
	it.each(shardGroups().map((g) => [`${g.index} ${g.accountability}|${g.permission}|${g.ip}`, g] as const))(
		'group %s',
		async (_label, group) => {
			const fixture = await buildGroup(group, ref);
			const failures: CellFailure[] = [];

			try {
				const shared = await makeTargets('directus', `parity-matrix-r${group.index}-${Date.now().toString(36)}`, ref);
				const reads = group.cells.filter((c) => c.action === 'read' || c.action === 'share');
				const writes = group.cells.filter((c) => c.action !== 'read' && c.action !== 'share');

				failures.push(...(await readCells(reads, fixture.headers, shared)));
				failures.push(...(await writeCells(group, writes, fixture.headers, ref)));
			} finally {
				await fixture.cleanup();
				await cleanupMatrix();
			}

			expect(failures.map((f) => `${f.cell}\n${f.detail}`).join('\n\n')).toBe('');
		},
		180_000,
	);
});

describe('cases outside the product', () => {
	it('FR-035: a user may change its own role and policies when its permissions allow it', async () => {
		const { leaf } = await createRoleTree('directus', 'parity-matrix-self');
		const { leaf: other } = await createRoleTree('directus', 'parity-matrix-self-other');
		const own = { id: { _eq: '$CURRENT_USER' } };

		await attachPolicy(
			'directus',
			await createPolicy('directus', 'parity-matrix-self', {
				permissions: [
					{ collection: 'directus_users', action: 'read', fields: ['*'], permissions: own },
					{ collection: 'directus_users', action: 'update', fields: ['role', 'status'], permissions: own },
				],
			}),
			{ role: leaf },
		);

		// Each app changes a user of its own; reads compared after both.
		const users = {
			directus: await createUser('directus', 'parity-matrix-self-d', { role: leaf }),
			backoffice: await createUser('directus', 'parity-matrix-self-b', { role: leaf }),
		};

		for (const app of ['directus', 'backoffice'] as const) {
			const res = await fetch(new URL(`/users/me?fields=role`, (await import('../directus-api.js')).appUrl(app)), {
				method: 'PATCH',
				headers: { authorization: `Bearer ${users[app].token}`, 'content-type': 'application/json' },
				body: JSON.stringify({ role: other }),
			});

			expect(res.status, app).toBe(200);
		}

		for (const app of ['directus', 'backoffice'] as const) {
			const { data } = await appRequest('directus', 'GET', `/users/${users[app].id}?fields=role`);
			expect(data.role, app).toBe(other);
		}
	});

	it('R-01: global access cached without the IP; an admin policy with ip_access, allowed then forbidden IP', async () => {
		const { leaf } = await createRoleTree('directus', 'parity-matrix-r01');
		await attachPolicy(
			'directus',
			await createPolicy('directus', 'parity-matrix-r01', { admin: true, ipAccess: [MATRIX_IP] }),
			{ role: leaf },
		);

		const user = await createUser('directus', 'parity-matrix-r01', { role: leaf });
		const token = signAccessToken({ id: user.id, role: leaf, app_access: true, admin_access: true });
		const as = (ip: string) => ({ authorization: `Bearer ${token}`, 'x-forwarded-for': ip });

		// Same order at both apps (one request to both at once): the second answer follows the cached global access.
		for (const ip of [MATRIX_IP, '10.78.0.5', '10.78.0.6']) {
			assertParity(await parity({ path: '/policies/me/globals', headers: as(ip) }));
			assertParity(await parity({ path: '/roles?fields=id&limit=1', headers: as(ip) }));
		}
	});
});
