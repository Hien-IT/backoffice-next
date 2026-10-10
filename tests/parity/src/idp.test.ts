import { createHash, createPublicKey, verify } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
// @ts-expect-error -- plain ESM script mounted into the `idp` container, no type declarations
import { createIdpServer } from '../idp/server.mjs';

let base = '';
let server: ReturnType<typeof createIdpServer>;

const client = { id: 'client', secret: 'secret' };
const basic = `Basic ${Buffer.from(`${client.id}:${client.secret}`).toString('base64')}`;

beforeAll(async () => {
	server = createIdpServer({ issuer: 'http://placeholder', clients: { [client.id]: client.secret } });
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const json = async (res: Response | Promise<Response>): Promise<any> => (await res).json();

const post = (path: string, body: string, headers: Record<string, string> = {}) =>
	fetch(`${base}${path}`, { method: 'POST', body, headers });

async function authorize(user: string, verifier: string, method: 'S256' | 'plain' = 'S256') {
	const challenge = method === 'S256' ? createHash('sha256').update(verifier).digest('base64url') : verifier;

	const url = new URL(`${base}/authorize`);
	url.search = new URLSearchParams({
		client_id: client.id,
		redirect_uri: 'http://app/cb',
		state: 'st',
		nonce: 'nn',
		code_challenge: challenge,
		code_challenge_method: method,
		user,
	}).toString();

	const res = await fetch(url, { redirect: 'manual' });
	return { res, location: new URL(res.headers.get('location') ?? 'http://none') };
}

const token = (form: Record<string, string>) =>
	post('/token', new URLSearchParams(form).toString(), {
		Authorization: basic,
		'Content-Type': 'application/x-www-form-urlencoded',
	});

describe('test IdP', () => {
	test('publishes discovery metadata and a JWKS', async () => {
		const discovery = await json(fetch(`${base}/.well-known/openid-configuration`));
		expect(discovery).toMatchObject({ issuer: 'http://placeholder', response_types_supported: ['code'] });

		const jwks = await json(fetch(`${base}/jwks`));
		expect(jwks.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
	});

	test('runs the code flow with PKCE, signs the id token and serves userinfo', async () => {
		await post('/__users', JSON.stringify({ sub: 'alice', claims: { email: 'alice@example.com' } }));

		const { res, location } = await authorize('alice', 'verifier-0123456789');
		expect(res.status).toBe(302);
		expect(location.searchParams.get('state')).toBe('st');

		const tokens = await json(
			token({
				grant_type: 'authorization_code',
				code: location.searchParams.get('code')!,
				redirect_uri: 'http://app/cb',
				code_verifier: 'verifier-0123456789',
			}),
		);

		const [header, payload, signature] = tokens.id_token.split('.');
		const jwks = await json(fetch(`${base}/jwks`));
		const key = createPublicKey({ key: jwks.keys[0], format: 'jwk' });
		expect(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), key, Buffer.from(signature, 'base64url'))).toBe(
			true,
		);
		expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toMatchObject({
			sub: 'alice',
			aud: 'client',
			nonce: 'nn',
		});

		const info = await fetch(`${base}/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
		expect(await info.json()).toEqual({ sub: 'alice', email: 'alice@example.com' });
	});

	test('rejects a wrong PKCE verifier, an unknown user and a wrong client', async () => {
		const { location } = await authorize('alice', 'right-verifier', 'plain');

		const wrong = await token({
			grant_type: 'authorization_code',
			code: location.searchParams.get('code')!,
			redirect_uri: 'http://app/cb',
			code_verifier: 'wrong-verifier',
		});

		expect(wrong.status).toBe(400);
		expect((await authorize('nobody', 'v')).res.status).toBe(400);

		const badClient = await post(
			'/token',
			'grant_type=refresh_token&refresh_token=x&client_id=client&client_secret=no',
		);
		expect(badClient.status).toBe(401);
	});

	test('rotates refresh tokens and can be told to answer invalid_grant', async () => {
		const { location } = await authorize('alice', 'verifier-refresh');

		const first = await json(
			token({
				grant_type: 'authorization_code',
				code: location.searchParams.get('code')!,
				redirect_uri: 'http://app/cb',
				code_verifier: 'verifier-refresh',
			}),
		);

		const refreshed = await json(token({ grant_type: 'refresh_token', refresh_token: first.refresh_token }));
		expect(refreshed.refresh_token).not.toBe(first.refresh_token);

		await post('/__refresh-error', '');
		const failed = await token({ grant_type: 'refresh_token', refresh_token: refreshed.refresh_token });
		expect(failed.status).toBe(400);
		expect(await failed.json()).toMatchObject({ error: 'invalid_grant' });

		await post('/__reset', '');
		expect((await authorize('alice', 'v')).res.status).toBe(400);
	});
});
