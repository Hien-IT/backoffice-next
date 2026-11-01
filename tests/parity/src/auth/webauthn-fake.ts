// Backoffice (spec 029, research R9): a software WebAuthn authenticator for the parity suite. It answers the options of
// /backoffice/auth/passkey/login/options and /backoffice/users/me/passkeys/options the way a browser plus a platform
// authenticator would: an EC P-256 (ES256) key, "none" attestation, a discoverable credential, user presence and user
// verification flags, and a signature counter. Only node:crypto, with the few CBOR types WebAuthn needs.
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

export interface RegistrationOptions {
	challenge: string;
	rp: { id?: string };
	user: { id: string };
}

export interface AuthenticationOptions {
	challenge: string;
	rpId?: string;
}

export interface CeremonyOptions {
	/** User verification flag (default true). */
	uv?: boolean;
	/** The origin written into clientDataJSON (default: the authenticator's origin). */
	origin?: string;
}

export interface FakeCredential {
	id: string;
	rpId: string;
	userHandle: string;
	privateKey: KeyObject;
	counter: number;
}

const b64u = (bytes: Uint8Array | Buffer) => Buffer.from(bytes).toString('base64url');
const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest();

function head(major: number, length: number): Buffer {
	if (length < 24) return Buffer.from([(major << 5) | length]);
	if (length < 0x100) return Buffer.from([(major << 5) | 24, length]);
	if (length < 0x10000) return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
	const out = Buffer.alloc(5);
	out[0] = (major << 5) | 26;
	out.writeUInt32BE(length, 1);
	return out;
}

/** CBOR for the values WebAuthn uses: integers, byte strings, text strings and maps (keys in insertion order). */
export function cbor(value: unknown): Buffer {
	if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
	if (typeof value === 'string') {
		const bytes = Buffer.from(value, 'utf8');
		return Buffer.concat([head(3, bytes.length), bytes]);
	}

	if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), Buffer.from(value)]);

	if (value instanceof Map) {
		const parts: Buffer[] = [head(5, value.size)];
		for (const [k, v] of value) parts.push(cbor(k), cbor(v));
		return Buffer.concat(parts);
	}

	throw new Error(`cbor: unsupported value ${String(value)}`);
}

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

function counterBytes(counter: number): Buffer {
	const out = Buffer.alloc(4);
	out.writeUInt32BE(counter >>> 0, 0);
	return out;
}

export function createFakeAuthenticator(defaults: { origin: string }) {
	const credentials: FakeCredential[] = [];

	function clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin: string): Buffer {
		return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }), 'utf8');
	}

	return {
		credentials,

		/** navigator.credentials.create(): a new discoverable credential for options.rp.id and options.user.id. */
		register(options: RegistrationOptions, ceremony: CeremonyOptions = {}) {
			const rpId = options.rp.id ?? new URL(defaults.origin).hostname;
			const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
			const jwk = publicKey.export({ format: 'jwk' });
			const credentialId = randomBytes(32);

			const coseKey = cbor(
				new Map<number, number | Uint8Array>([
					[1, 2], // kty: EC2
					[3, -7], // alg: ES256
					[-1, 1], // crv: P-256
					[-2, Buffer.from(jwk.x!, 'base64url')],
					[-3, Buffer.from(jwk.y!, 'base64url')],
				]),
			);

			const idLength = Buffer.alloc(2);
			idLength.writeUInt16BE(credentialId.length, 0);
			const flags = FLAG_UP | FLAG_AT | (ceremony.uv === false ? 0 : FLAG_UV);

			const authData = Buffer.concat([
				sha256(rpId),
				Buffer.from([flags]),
				counterBytes(0),
				Buffer.alloc(16), // aaguid: none
				idLength,
				credentialId,
				coseKey,
			]);

			const attestationObject = cbor(
				new Map<string, unknown>([
					['fmt', 'none'],
					['attStmt', new Map()],
					['authData', authData],
				]),
			);

			const id = b64u(credentialId);
			credentials.push({ id, rpId, userHandle: options.user.id, privateKey, counter: 0 });

			return {
				id,
				rawId: id,
				type: 'public-key' as const,
				response: {
					clientDataJSON: b64u(clientData('webauthn.create', options.challenge, ceremony.origin ?? defaults.origin)),
					attestationObject: b64u(attestationObject),
					transports: ['internal'],
				},
				clientExtensionResults: {},
				authenticatorAttachment: 'platform' as const,
			};
		},

		/**
		 * navigator.credentials.get() with an empty allowCredentials: the last credential for the RP ID answers (the user
		 * picks it in the browser dialog). `counter` forces the signature counter (replay tests); default: previous + 1.
		 */
		authenticate(
			options: AuthenticationOptions,
			ceremony: CeremonyOptions & { counter?: number; credentialId?: string } = {},
		) {
			const rpId = options.rpId ?? new URL(defaults.origin).hostname;

			const credential = ceremony.credentialId
				? credentials.find((c) => c.id === ceremony.credentialId)
				: [...credentials].reverse().find((c) => c.rpId === rpId);

			if (!credential) throw new Error(`fake authenticator: no credential for ${rpId}`);

			credential.counter = ceremony.counter ?? credential.counter + 1;
			const flags = FLAG_UP | (ceremony.uv === false ? 0 : FLAG_UV);
			const authData = Buffer.concat([sha256(rpId), Buffer.from([flags]), counterBytes(credential.counter)]);
			const data = clientData('webauthn.get', options.challenge, ceremony.origin ?? defaults.origin);
			const signature = sign('sha256', Buffer.concat([authData, sha256(data)]), credential.privateKey);

			return {
				id: credential.id,
				rawId: credential.id,
				type: 'public-key' as const,
				response: {
					clientDataJSON: b64u(data),
					authenticatorData: b64u(authData),
					signature: b64u(signature),
					userHandle: credential.userHandle,
				},
				clientExtensionResults: {},
				authenticatorAttachment: 'platform' as const,
			};
		},
	};
}
