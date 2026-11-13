// Spec 032 US5 (FR-004, FR-005, contracts/tests.md §2b, profile sync): every refusal happens before any config is read,
// with a clear reason that never repeats the token or the source host.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { fakeSource, sourceToken, TARGET, target } from './helpers.js';

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
