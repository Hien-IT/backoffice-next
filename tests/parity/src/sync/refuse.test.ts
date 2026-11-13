// Spec 032 US5 (FR-004, FR-005, contracts/tests.md §2b, profile sync): every refusal happens before any config is read,
// with a clear reason that never repeats the token or the source host.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { knexConfig } from '../config.js';
import { apply, diff, fakeSource, rowOf, source, sourceToken, TARGET, TARGET_2, target, uuid } from './helpers.js';
import { collectionBody } from './seed.js';

const USER_TOKEN = `sync-refuse-user-${Date.now()}`;
let userId: string | undefined;

const compare = async (url: string, token?: string, as?: string) =>
	target(
		'POST',
		'/backoffice/sync/diff',
		{ url, token: token ?? (await sourceToken()), groups: ['folders'] },
		as ? { token: as } : {},
	);

const reason = (answer: { body: any }) => answer.body?.errors?.[0]?.extensions?.reason as string | undefined;

describe.skipIf(!TARGET)('profile sync: refusals before reading', () => {
	beforeAll(async () => {
		const created = await target('POST', '/users', {
			email: `sync-refuse-${Date.now()}@example.com`,
			password: 'sync-refuse-password',
			token: USER_TOKEN,
		});

		userId = created.body?.data?.id;
	});

	afterAll(async () => {
		if (userId) await target('DELETE', `/users/${userId}`);
	});

	test('a pure Directus source does not support environment sync (400)', async () => {
		const answer = await compare('http://directus:8055');
		expect(answer.status).toBe(400);
		expect(reason(answer)).toBe('The source does not support environment sync');
	});

	test('a wrong token is a 400 at the target, never a 401 (the admin stays signed in)', async () => {
		const answer = await compare('http://backoffice-api:8055', 'not-a-valid-token');
		expect(answer.status).toBe(400);
		expect(reason(answer)).toBe('The source rejected the token');
	});

	test('a host that does not resolve cannot be reached (503); localhost is denied by IMPORT_IP_DENY_LIST (400)', async () => {
		const unreachable = await compare('http://sync-source-does-not-exist.invalid:8055');
		expect(unreachable.status).toBe(503);
		expect(reason(unreachable)).toBe('The source could not be reached');

		const local = await compare('http://localhost:8055');
		expect(local.status).toBe(400);
		expect(reason(local)).toBe('The source address is not allowed');
	});

	test('another Backoffice version is refused naming both versions', async () => {
		const answer = await compare(fakeSource('mismatch'));
		expect(answer.status).toBe(400);
		expect(reason(answer)).toMatch(/^Version mismatch: source Backoffice 0\.0\.0-fake, target \S+$/);
	});

	test('a redirect is never followed; a wrong shape is an unexpected response (503)', async () => {
		const redirect = await compare(fakeSource('redirect'));
		expect(redirect.status).toBe(503);
		expect(reason(redirect)).toBe('The source redirected the request');

		const shape = await compare(fakeSource('shape'));
		expect(shape.status).toBe(503);
		expect(reason(shape)).toBe('The source returned an unexpected response');
	});

	test('a source slower than 30 seconds times out (503)', async () => {
		const answer = await compare(fakeSource('slow'));
		expect(answer.status).toBe(503);
		expect(reason(answer)).toBe('The source timed out');
	}, 60_000);

	test('a user who is not admin at the target gets 403; an http(s) URL with credentials is a 400', async () => {
		expect((await compare('http://backoffice-api:8055', undefined, USER_TOKEN)).status).toBe(403);

		const credentials = await compare('http://user:pass@backoffice-api:8055');
		expect(credentials.status).toBe(400);
		expect(reason(credentials)).toBe('"url" must be an http or https URL without credentials');
	});

	test('no error repeats the token or the source host', async () => {
		const token = await sourceToken();
		const answers = await Promise.all([compare('http://directus:8055', token), compare(fakeSource('shape'), token)]);
		const text = JSON.stringify(answers.map((a) => a.body));
		expect(text).not.toContain(token);
		expect(text).not.toMatch(/directus:8055|registry:9100/);
	});
});

const status = (answer: { status: number }) => answer.status;

describe.skipIf(!TARGET)('profile sync: refusals when applying', () => {
	let sourceDb: Knex;
	const folders: string[] = [];

	beforeAll(() => {
		sourceDb = knex(knexConfig.postgres);
	});

	afterAll(async () => {
		for (const id of folders) {
			await source('DELETE', `/folders/${id}`).catch(() => undefined);
			await target('DELETE', `/folders/${id}`);
		}

		await sourceDb.destroy();
	});

	async function sourceFolder(parent: string | null = null) {
		const id = uuid();
		folders.push(id);
		await source('POST', '/folders', { id, name: `Refuse ${id.slice(0, 8)}`, parent });
		return id;
	}

	test('FR-022: a change at the source or at the target after the comparison refuses the apply; nothing changes', async () => {
		const folder = await sourceFolder();
		const compared = (await diff(['folders'])).body.data;

		await source('PATCH', `/folders/${folder}`, { name: 'Renamed after the comparison' });
		const atSource = await apply(compared, [`folders/folder:${folder}`]);
		expect(status(atSource)).toBe(400);
		expect(reason(atSource)).toBe('The comparison is out of date, compare again');
		expect(status(await target('GET', `/folders/${folder}`))).toBe(403);

		const again = (await diff(['folders'])).body.data;
		const local = uuid();
		folders.push(local);
		await target('POST', '/folders', { id: local, name: 'Made at the target after the comparison' });
		expect(reason(await apply(again, [`folders/folder:${folder}`]))).toBe(
			'The comparison is out of date, compare again',
		);
	});

	test('FR-020: a missing dependency is refused before any write, even when sent straight to the API', async () => {
		const parent = await sourceFolder();
		const child = await sourceFolder(parent);
		const compared = (await diff(['folders'])).body.data;

		expect(rowOf(compared.rows, `folders/folder:${child}`).depends).toEqual([`folders/folder:${parent}`]);
		const answer = await apply(compared, [`folders/folder:${child}`]);
		expect(status(answer)).toBe(400);
		expect(reason(answer)).toBe(`Row "folders/folder:${child}" needs "folders/folder:${parent}"`);
		expect(status(await target('GET', `/folders/${child}`))).toBe(403);
	});

	test('FR-026: two applies at once: one runs; the other gets 503 (same node at once) or 400 (stale), never both run', async () => {
		const folder = await sourceFolder();
		const compared = (await diff(['folders'])).body.data;
		const selected = [`folders/folder:${folder}`];

		const sameNode = await Promise.all([apply(compared, selected), apply(compared, selected)]);
		expect(sameNode.map(status).sort()).toEqual(expect.arrayContaining([200]));
		expect(sameNode.filter((a) => status(a) === 200)).toHaveLength(1);
		expect(sameNode.map(status).every((s) => [200, 400, 503].includes(s))).toBe(true);

		const second = await sourceFolder();
		const next = (await diff(['folders'])).body.data;
		const both = await Promise.all([
			apply(next, [`folders/folder:${second}`]),
			apply(next, [`folders/folder:${second}`], {}, TARGET_2!),
		]);

		expect(both.filter((a) => status(a) === 200)).toHaveLength(1);
		expect(both.map(status).every((s) => [200, 400, 503].includes(s))).toBe(true);
	}, 60_000);

	test('a token revoked between the comparison and the apply is refused (400) and nothing changes', async () => {
		const role = (await source('GET', '/roles?filter[name][_eq]=Administrator&fields=id')).data[0]?.id;
		const token = `sync-revoke-${uuid()}`;
		const user = (
			await source('POST', '/users', { email: `${token}@example.com`, password: 'x-password-x', role, token })
		).data.id;
		const folder = await sourceFolder();

		const compared = (await diff(['folders'], { token })).body.data;
		await source('DELETE', `/users/${user}`);

		const answer = await apply(compared, [`folders/folder:${folder}`], { token });
		expect(status(answer)).toBe(400);
		expect(reason(answer)).toBe('The source rejected the token');
		expect(status(await target('GET', `/folders/${folder}`))).toBe(403);
	});

	test('SC-004: a write that fails after the new collection was created leaves no collection and no row', async () => {
		const collection = `parity_sync_fail_${uuid().slice(0, 8)}`;
		const policy = uuid();
		await source('POST', '/collections', collectionBody(collection));
		// A policy the API would refuse (PoliciesService checks ip_access): written straight into the source database.
		await sourceDb('directus_policies').insert({
			id: policy,
			name: 'Broken ip_access',
			icon: 'badge',
			ip_access: 'not-an-ip',
		});

		try {
			const compared = (await diff(['schema', 'access'])).body.data;
			const answer = await apply(compared, [`schema/collection:${collection}`, `access/policy:${policy}`]);

			expect(status(answer)).toBe(400);
			expect(answer.body.errors[0].extensions.row).toBe(`access/policy:${policy}`);
			expect(status(await target('GET', `/collections/${collection}`))).toBe(403);
			expect(status(await target('GET', `/policies/${policy}`))).toBe(403);
		} finally {
			await sourceDb('directus_policies').where('id', policy).delete();
			await source('DELETE', `/collections/${collection}`).catch(() => undefined);
		}
	}, 120_000);
});
