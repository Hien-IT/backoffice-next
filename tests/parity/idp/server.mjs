// Test identity provider for the `sso` profile (specs/003-auth-session research R10): OpenID Connect discovery,
// JWKS, authorization code with PKCE, refresh tokens and userinfo, plus admin endpoints the parity tests use to set
// claims and force errors. Only node:http and node:crypto, so the `node:22-alpine` image runs it without a build.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const b64url = (input) => Buffer.from(input).toString('base64url');

function signJwt(payload, privateKey, kid) {
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
	const body = b64url(JSON.stringify(payload));
	const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
	return `${header}.${body}.${signature}`;
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function send(res, status, body, headers = {}) {
	res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
	res.end(body === undefined ? '' : JSON.stringify(body));
}

export function createIdpServer({ issuer, clients = {} } = {}) {
	const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const kid = randomBytes(8).toString('hex');
	const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };

	const state = {
		users: new Map(), // sub -> claims
		codes: new Map(), // code -> { sub, clientId, redirectUri, nonce, challenge, method }
		accessTokens: new Map(), // token -> sub
		refreshTokens: new Map(), // token -> { sub, clientId }
		failNextRefresh: false,
	};

	const base = () => issuer;

	function issueTokens(sub, clientId, nonce) {
		const now = Math.floor(Date.now() / 1000);
		const accessToken = randomBytes(24).toString('base64url');
		const refreshToken = randomBytes(24).toString('base64url');
		state.accessTokens.set(accessToken, sub);
		state.refreshTokens.set(refreshToken, { sub, clientId });

		const idToken = signJwt(
			{ iss: base(), sub, aud: clientId, iat: now, exp: now + 300, ...(nonce ? { nonce } : {}) },
			privateKey,
			kid,
		);

		return {
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: 3600,
			refresh_token: refreshToken,
			id_token: idToken,
			scope: 'openid profile email',
		};
	}

	function clientFrom(req, form) {
		const auth = req.headers.authorization;

		if (auth?.startsWith('Basic ')) {
			const [id, secret] = Buffer.from(auth.slice(6), 'base64').toString().split(':').map(decodeURIComponent);
			return { id, secret };
		}

		return { id: form.get('client_id'), secret: form.get('client_secret') };
	}

	function clientValid({ id, secret }) {
		if (!id) return false;
		return !(id in clients) || clients[id] === secret;
	}

	const server = createServer(async (req, res) => {
		const url = new URL(req.url, base());

		try {
			if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });

			if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
				return send(res, 200, {
					issuer: base(),
					authorization_endpoint: `${base()}/authorize`,
					token_endpoint: `${base()}/token`,
					userinfo_endpoint: `${base()}/userinfo`,
					jwks_uri: `${base()}/jwks`,
					response_types_supported: ['code'],
					subject_types_supported: ['public'],
					id_token_signing_alg_values_supported: ['RS256'],
					token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
					code_challenge_methods_supported: ['S256', 'plain'],
					grant_types_supported: ['authorization_code', 'refresh_token'],
					scopes_supported: ['openid', 'profile', 'email'],
				});
			}

			if (req.method === 'GET' && url.pathname === '/jwks') return send(res, 200, { keys: [jwk] });

			if (req.method === 'GET' && url.pathname === '/authorize') {
				const sub = url.searchParams.get('user');
				const redirectUri = url.searchParams.get('redirect_uri');
				if (!sub || !state.users.has(sub) || !redirectUri) return send(res, 400, { error: 'invalid_request' });

				const code = randomBytes(16).toString('base64url');

				state.codes.set(code, {
					sub,
					clientId: url.searchParams.get('client_id'),
					redirectUri,
					nonce: url.searchParams.get('nonce'),
					challenge: url.searchParams.get('code_challenge'),
					method: url.searchParams.get('code_challenge_method') ?? 'plain',
				});

				const target = new URL(redirectUri);
				target.searchParams.set('code', code);
				const stateParam = url.searchParams.get('state');
				if (stateParam) target.searchParams.set('state', stateParam);
				res.writeHead(302, { Location: target.toString() });
				return res.end();
			}

			if (req.method === 'POST' && url.pathname === '/token') {
				const form = new URLSearchParams(await readBody(req));
				const client = clientFrom(req, form);
				if (!clientValid(client)) return send(res, 401, { error: 'invalid_client' });

				if (form.get('grant_type') === 'authorization_code') {
					const entry = state.codes.get(form.get('code') ?? '');
					state.codes.delete(form.get('code') ?? '');

					if (!entry || entry.redirectUri !== form.get('redirect_uri') || entry.clientId !== client.id) {
						return send(res, 400, { error: 'invalid_grant', error_description: 'unknown code' });
					}

					const verifier = form.get('code_verifier') ?? '';
					const expected =
						entry.method === 'S256' ? createHash('sha256').update(verifier).digest('base64url') : verifier;

					if (entry.challenge && expected !== entry.challenge) {
						return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
					}

					return send(res, 200, issueTokens(entry.sub, client.id, entry.nonce));
				}

				if (form.get('grant_type') === 'refresh_token') {
					const entry = state.refreshTokens.get(form.get('refresh_token') ?? '');

					if (state.failNextRefresh || !entry) {
						state.failNextRefresh = false;
						return send(res, 400, { error: 'invalid_grant', error_description: 'refresh token is not valid' });
					}

					state.refreshTokens.delete(form.get('refresh_token'));
					return send(res, 200, issueTokens(entry.sub, client.id));
				}

				return send(res, 400, { error: 'unsupported_grant_type' });
			}

			if (req.method === 'GET' && url.pathname === '/userinfo') {
				const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
				const sub = state.accessTokens.get(token);
				if (!sub) return send(res, 401, { error: 'invalid_token' });
				return send(res, 200, { sub, ...state.users.get(sub) });
			}

			if (req.method === 'POST' && url.pathname === '/__users') {
				const { sub, claims = {} } = JSON.parse(await readBody(req));
				state.users.set(sub, claims);
				return send(res, 204);
			}

			if (req.method === 'POST' && url.pathname === '/__refresh-error') {
				state.failNextRefresh = true;
				return send(res, 204);
			}

			if (req.method === 'POST' && url.pathname === '/__reset') {
				state.users.clear();
				state.codes.clear();
				state.accessTokens.clear();
				state.refreshTokens.clear();
				state.failNextRefresh = false;
				return send(res, 204);
			}

			return send(res, 404, { error: 'not_found' });
		} catch (error) {
			return send(res, 500, { error: 'server_error', error_description: String(error) });
		}
	});

	return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const port = Number(process.env['PORT'] ?? 9000);
	const issuer = process.env['IDP_ISSUER'] ?? `http://localhost:${port}`;
	const clients = JSON.parse(process.env['IDP_CLIENTS'] ?? '{}');
	createIdpServer({ issuer, clients }).listen(port, () =>
		process.stdout.write(`Test IdP listening on ${port} as ${issuer}\n`),
	);
}
