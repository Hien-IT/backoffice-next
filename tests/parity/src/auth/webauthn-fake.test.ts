// Backoffice (spec 029, T001 + T020): the fake authenticator passes the checks of @simplewebauthn/server 14, the
// library the API uses, so the parity suite drives real ceremonies against Backoffice.
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { describe, expect, test } from 'vitest';
import { cbor, createFakeAuthenticator } from './webauthn-fake.js';

const origin = 'http://localhost:8162';
const rpID = 'localhost';
const userID = Uint8Array.from(Buffer.from('2d6b8f100c4e4b5a8d7e9a1b2c3d4e5f', 'hex'));

async function registered(uv = true) {
	const fake = createFakeAuthenticator({ origin });

	const options = await generateRegistrationOptions({
		rpName: 'Backoffice',
		rpID,
		userName: 'user@example.com',
		userID,
		attestationType: 'none',
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
	});

	const response = fake.register(options, { uv });

	return { fake, options, response };
}

describe('cbor', () => {
	test('encodes the WebAuthn subset', () => {
		expect(cbor(1).toString('hex')).toBe('01');
		expect(cbor(-7).toString('hex')).toBe('26');
		expect(cbor(500).toString('hex')).toBe('1901f4');
		expect(cbor('fmt').toString('hex')).toBe('63666d74');
		expect(cbor(new Uint8Array([1, 2])).toString('hex')).toBe('420102');
		expect(cbor(new Map([[1, 2]])).toString('hex')).toBe('a10102');
	});
});

describe('fake authenticator against @simplewebauthn/server', () => {
	test('registration verifies with user verification required and gives the credential', async () => {
		const { options, response } = await registered();

		const result = await verifyRegistrationResponse({
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			requireUserVerification: true,
		});

		expect(result.verified).toBe(true);
		expect(result.registrationInfo?.credential.id).toBe(response.id);
		expect(result.registrationInfo?.credential.counter).toBe(0);
		expect(result.registrationInfo?.credential.publicKey).toBeInstanceOf(Uint8Array);
		expect(result.registrationInfo?.credentialDeviceType).toBe('singleDevice');
		expect(options.user.id).toBe(Buffer.from(userID).toString('base64url'));
	});

	test('registration without user verification is refused', async () => {
		const { options, response } = await registered(false);

		await expect(
			verifyRegistrationResponse({
				response,
				expectedChallenge: options.challenge,
				expectedOrigin: origin,
				expectedRPID: rpID,
				requireUserVerification: true,
			}),
		).rejects.toThrow();
	});

	test('authentication verifies, counts, and refuses replay, missing UV and another origin', async () => {
		const { fake, options, response } = await registered();

		const { registrationInfo } = await verifyRegistrationResponse({
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
		});

		const credential = registrationInfo!.credential;

		const login = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] });
		const assertion = fake.authenticate(login);
		expect(assertion.response.userHandle).toBe(options.user.id);

		const ok = await verifyAuthenticationResponse({
			response: assertion,
			expectedChallenge: login.challenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			credential,
			requireUserVerification: true,
		});

		expect(ok.verified).toBe(true);
		expect(ok.authenticationInfo.newCounter).toBe(1);

		const verify = (a: ReturnType<typeof fake.authenticate>, stored = 0) =>
			verifyAuthenticationResponse({
				response: a,
				expectedChallenge: login.challenge,
				expectedOrigin: origin,
				expectedRPID: rpID,
				credential: { ...credential, counter: stored },
				requireUserVerification: true,
			});

		await expect(verify(fake.authenticate(login, { counter: 3 }), 5)).rejects.toThrow();
		await expect(verify(fake.authenticate(login, { uv: false }))).rejects.toThrow();
		await expect(verify(fake.authenticate(login, { origin: 'http://evil.localhost' }))).rejects.toThrow();
	});
});
