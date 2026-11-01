// Backoffice (spec 029, T014 + T018): PasskeyService with the WebAuthn library, the challenge store and the
// AuthenticationService steps mocked; the real ceremonies run in tests/parity/src/auth/passkey.test.ts.
import { useEnv } from '@backoffice/env';
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from '@simplewebauthn/server';
import knex, { type Knex } from 'knex';
import { createTracker, MockClient, type Tracker } from 'knex-mock-client';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
	type MockedFunction,
	type MockInstance,
} from 'vitest';
import { putChallenge, takeChallenge } from '../auth/passkey/challenge-store.js';
import { getPasskeyRp } from '../auth/passkey/rp.js';
import emitter from '../emitter.js';
import { stall } from '../utils/stall.js';
import { AuthenticationService } from './authentication.service.js';
import { MAX_PASSKEYS, PasskeyService } from './passkey.service.js';

vi.mock('@simplewebauthn/server');
vi.mock('../auth/passkey/challenge-store.js', () => ({
	putChallenge: vi.fn(),
	takeChallenge: vi.fn(),
	CHALLENGE_TTL: 300000,
}));
vi.mock('../auth/passkey/rp.js', () => ({ getPasskeyRp: vi.fn() }));
vi.mock('../utils/stall.js', () => ({ stall: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn() }) }));
vi.mock('@backoffice/env', () => ({ useEnv: vi.fn().mockReturnValue({ LOGIN_STALL_TIME: 500 }) }));

vi.mock('../emitter.js', () => ({
	default: {
		emitFilter: vi.fn().mockImplementation((_event, payload) => Promise.resolve(payload)),
		emitAction: vi.fn(),
	},
}));

const schema = new SchemaBuilder()
	.collection('directus_users', (c) => {
		c.field('id').uuid().primary();
	})
	.build();

const USER = '2d6b8f10-0c4e-4b5a-8d7e-9a1b2c3d4e5f';

const user = (over: Record<string, unknown> = {}) => ({
	id: USER,
	email: 'u@example.com',
	first_name: 'Ann',
	last_name: 'Lee',
	status: 'active',
	provider: 'default',
	role: 'r1',
	tfa_secret: null,
	...over,
});

const row = (over: Record<string, unknown> = {}) => ({
	id: 'pk-1',
	user: USER,
	credential_id: 'cred-1',
	public_key: Buffer.from('key').toString('base64url'),
	counter: '2',
	transports: '["internal"]',
	name: 'MacBook',
	device_type: 'singleDevice',
	backed_up: 0,
	date_created: new Date('2026-11-01T09:00:00Z'),
	last_used: null,
	...over,
});

const clientData = (challenge: string) =>
	Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: 'http://localhost:8162' })).toString(
		'base64url',
	);

const assertion = (challenge = 'ch-login', id = 'cred-1') => ({
	id,
	rawId: id,
	type: 'public-key',
	response: { clientDataJSON: clientData(challenge), authenticatorData: 'x', signature: 'y', userHandle: 'z' },
	clientExtensionResults: {},
});

const attestation = (challenge = 'ch-reg') => ({
	id: 'cred-new',
	rawId: 'cred-new',
	type: 'public-key',
	response: { clientDataJSON: clientData(challenge), attestationObject: 'a', transports: ['internal'] },
	clientExtensionResults: {},
});

describe('PasskeyService', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;
	let service: PasskeyService;

	beforeAll(() => {
		db = vi.mocked(knex({ client: MockClient }));
		tracker = createTracker(db);
	});

	beforeEach(() => {
		service = new PasskeyService({ knex: db, schema, accountability: { ip: '127.0.0.1' } as any });
		// restoreAllMocks (afterEach) also resets the vi.fn of the vi.mock factories.
		vi.mocked(getPasskeyRp).mockReturnValue({ rpId: 'localhost', origin: 'http://localhost:8162' });
		vi.mocked(useEnv).mockReturnValue({ LOGIN_STALL_TIME: 500 } as any);
		vi.mocked(stall).mockResolvedValue(undefined);
		vi.mocked(emitter.emitFilter).mockImplementation((_event, payload) => Promise.resolve(payload) as any);
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	describe('registration (US2)', () => {
		test('options: password checked, discoverable + UV required, existing credentials excluded, challenge stored', async () => {
			const verifyPassword = vi.spyOn(AuthenticationService.prototype, 'verifyPassword').mockResolvedValue();
			tracker.on.select('directus_users').responseOnce([user()]);
			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.select('directus_settings').responseOnce([{ project_name: 'Acme' }]);
			vi.mocked(generateRegistrationOptions).mockResolvedValue({ challenge: 'ch-reg' } as any);

			const options = await service.registrationOptions(USER, 'pw');

			expect(options).toEqual({ challenge: 'ch-reg' });
			expect(verifyPassword).toHaveBeenCalledWith(USER, 'pw');

			expect(vi.mocked(generateRegistrationOptions).mock.calls[0]![0]).toMatchObject({
				rpName: 'Acme',
				rpID: 'localhost',
				userName: 'u@example.com',
				userDisplayName: 'Ann Lee',
				attestationType: 'none',
				excludeCredentials: [{ id: 'cred-1', transports: ['internal'] }],
				authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
			});

			expect(Buffer.from(vi.mocked(generateRegistrationOptions).mock.calls[0]![0].userID!).toString('hex')).toBe(
				USER.replace(/-/g, ''),
			);

			expect(putChallenge).toHaveBeenCalledWith('ch-reg', { purpose: 'register', user: USER });
		});

		test('options: wrong password is the password error, no challenge', async () => {
			vi.spyOn(AuthenticationService.prototype, 'verifyPassword').mockRejectedValue(new InvalidCredentialsError());
			tracker.on.select('directus_users').responseOnce([user()]);

			await expect(service.registrationOptions(USER, 'bad')).rejects.toBeInstanceOf(InvalidCredentialsError);
			expect(putChallenge).not.toHaveBeenCalled();
		});

		test('options: an LDAP/SSO user is forbidden; ten passkeys is the limit', async () => {
			tracker.on.select('directus_users').responseOnce([user({ provider: 'ldap' })]);
			await expect(service.registrationOptions(USER, 'pw')).rejects.toBeInstanceOf(ForbiddenError);

			vi.spyOn(AuthenticationService.prototype, 'verifyPassword').mockResolvedValue();
			tracker.on.select('directus_users').responseOnce([user()]);
			tracker.on
				.select('backoffice_passkeys')
				.responseOnce(Array.from({ length: MAX_PASSKEYS }, (_, i) => row({ id: `p${i}` })));

			await expect(service.registrationOptions(USER, 'pw')).rejects.toThrow(/maximum of 10 passkeys/);
		});

		test('register: verified response stored with the public columns returned', async () => {
			tracker.on.select('directus_users').responseOnce([user()]);
			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'register', user: USER, expires: Date.now() + 1000 });
			tracker.on.select('backoffice_passkeys').responseOnce([]);
			tracker.on.select('backoffice_passkeys').responseOnce([]);
			tracker.on.insert('backoffice_passkeys').responseOnce([1]);

			vi.mocked(verifyRegistrationResponse).mockResolvedValue({
				verified: true,
				registrationInfo: {
					credential: { id: 'cred-new', publicKey: new Uint8Array([1, 2]), counter: 0, transports: ['internal'] },
					credentialDeviceType: 'multiDevice',
					credentialBackedUp: true,
				},
			} as any);

			const created = await service.register(USER, attestation() as any, '  My Mac  ');

			expect(vi.mocked(verifyRegistrationResponse).mock.calls[0]![0]).toMatchObject({
				expectedChallenge: 'ch-reg',
				expectedOrigin: 'http://localhost:8162',
				expectedRPID: 'localhost',
				requireUserVerification: true,
			});

			const insert = tracker.history.insert[0]!;
			expect(insert.sql).toMatch(/backoffice_passkeys/);
			expect(insert.bindings).toEqual(expect.arrayContaining(['cred-new', 'AQI', 'My Mac', 'multiDevice', true]));
			expect(created).toMatchObject({ name: 'My Mac', device_type: 'multiDevice', backed_up: true, last_used: null });
			expect(created).not.toHaveProperty('credential_id');
			expect(created).not.toHaveProperty('public_key');
		});

		test('register: refused for a missing, login or other user challenge, a failed check, a long id, a duplicate, a bad name', async () => {
			const attempt = async (setup: () => void, response: any = attestation(), name = 'Mac') => {
				tracker.reset();
				tracker.on.select('directus_users').responseOnce([user()]);
				setup();
				await expect(service.register(USER, response, name)).rejects.toBeInstanceOf(InvalidPayloadError);
			};

			const ok = { purpose: 'register' as const, user: USER, expires: Date.now() + 1000 };
			const verified = (id = 'cred-new') =>
				vi.mocked(verifyRegistrationResponse).mockResolvedValue({
					verified: true,
					registrationInfo: { credential: { id, publicKey: new Uint8Array([1]), counter: 0 } },
				} as any);

			await attempt(() => vi.mocked(takeChallenge).mockResolvedValue(undefined));
			await attempt(() => vi.mocked(takeChallenge).mockResolvedValue({ ...ok, purpose: 'login' }));
			await attempt(() => vi.mocked(takeChallenge).mockResolvedValue({ ...ok, user: 'other' }));

			await attempt(() => {
				vi.mocked(takeChallenge).mockResolvedValue(ok);
				tracker.on.select('backoffice_passkeys').response([]);
				vi.mocked(verifyRegistrationResponse).mockRejectedValue(new Error('User verification required'));
			});

			await attempt(() => {
				vi.mocked(takeChallenge).mockResolvedValue(ok);
				tracker.on.select('backoffice_passkeys').response([]);
				verified('x'.repeat(256));
			});

			await attempt(() => {
				vi.mocked(takeChallenge).mockResolvedValue(ok);
				tracker.on.select('backoffice_passkeys').responseOnce([]);
				tracker.on.select('backoffice_passkeys').responseOnce([row({ credential_id: 'cred-new' })]);
				verified();
			});

			await attempt(() => undefined, attestation(), '   ');
			await attempt(() => undefined, attestation(), 'x'.repeat(101));
		});
	});

	describe('management (US2, US3)', () => {
		test('list: own passkeys oldest first, public columns only', async () => {
			tracker.on.select('directus_users').responseOnce([user()]);
			tracker.on.select('backoffice_passkeys').responseOnce([row()]);

			const list = await service.list(USER);

			expect(tracker.history.select[1]!.sql).toMatch(/order by .date_created. asc/i);

			expect(list).toEqual([
				{
					id: 'pk-1',
					name: 'MacBook',
					date_created: '2026-11-01T09:00:00.000Z',
					last_used: null,
					device_type: 'singleDevice',
					backed_up: false,
					transports: ['internal'],
				},
			]);
		});

		test("rename and remove: another user's passkey is forbidden; own works without password", async () => {
			tracker.on.select('directus_users').response([user()]);
			tracker.on.select('backoffice_passkeys').responseOnce([row({ user: 'other' })]);
			await expect(service.rename(USER, 'pk-1', 'New')).rejects.toBeInstanceOf(ForbiddenError);

			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.update('backoffice_passkeys').responseOnce(1);
			tracker.on.select('backoffice_passkeys').responseOnce([row({ name: 'New' })]);
			await expect(service.rename(USER, 'pk-1', 'New')).resolves.toMatchObject({ name: 'New' });

			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.delete('backoffice_passkeys').responseOnce(1);
			await service.remove(USER, 'pk-1');
			expect(tracker.history.delete).toHaveLength(1);
		});

		test('admin: list of a non-local user is empty; delete checks the owner', async () => {
			tracker.on.select('directus_users').responseOnce([user({ provider: 'openid' })]);
			await expect(service.listForAdmin(USER)).resolves.toEqual([]);

			tracker.on.select('backoffice_passkeys').responseOnce([row({ user: 'other' })]);
			await expect(service.removeForAdmin(USER, 'pk-1')).rejects.toBeInstanceOf(ForbiddenError);

			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.delete('backoffice_passkeys').responseOnce(1);
			await service.removeForAdmin(USER, 'pk-1');
			expect(tracker.history.delete).toHaveLength(1);
		});
	});

	describe('login (US1, US4)', () => {
		let consume: MockInstance<AuthenticationService['consumeLoginAttempt']>;
		let finish: MockInstance<AuthenticationService['finishLogin']>;

		beforeEach(() => {
			consume = vi.spyOn(AuthenticationService.prototype, 'consumeLoginAttempt').mockResolvedValue(5);
			finish = vi.spyOn(AuthenticationService.prototype, 'finishLogin').mockResolvedValue({
				accessToken: 'a',
				refreshToken: 'r',
				expires: 1,
				id: USER,
			});
		});

		test('options: discoverable (no allowCredentials), UV required, login challenge stored', async () => {
			vi.mocked(generateAuthenticationOptions).mockResolvedValue({ challenge: 'ch-login' } as any);

			await expect(service.loginOptions()).resolves.toEqual({ challenge: 'ch-login' });

			expect(vi.mocked(generateAuthenticationOptions).mock.calls[0]![0]).toMatchObject({
				rpID: 'localhost',
				allowCredentials: [],
				userVerification: 'required',
			});

			expect(putChallenge).toHaveBeenCalledWith('ch-login', { purpose: 'login' });
		});

		test('success: counter and last_used updated, finishLogin with passkey true, auth.login payload marked', async () => {
			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'login', expires: Date.now() + 1000 });
			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.select('directus_users').responseOnce([user({ tfa_secret: 'secret' })]);
			tracker.on.update('backoffice_passkeys').responseOnce(1);

			vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
				verified: true,
				authenticationInfo: { newCounter: 3 },
			} as any);

			const result = await service.login(assertion() as any, 'session');

			expect(result).toMatchObject({ accessToken: 'a' });

			expect(vi.mocked(verifyAuthenticationResponse).mock.calls[0]![0]).toMatchObject({
				expectedChallenge: 'ch-login',
				expectedOrigin: 'http://localhost:8162',
				expectedRPID: 'localhost',
				requireUserVerification: true,
				credential: { id: 'cred-1', counter: 2, transports: ['internal'] },
			});

			expect(tracker.history.update[0]!.bindings).toEqual(expect.arrayContaining([3]));
			expect(consume).toHaveBeenCalledOnce();

			expect(finish.mock.calls[0]![2]).toMatchObject({
				providerName: 'default',
				passkey: true,
				session: true,
				allowedAttempts: 5,
			});

			expect(vi.mocked(emitter.emitFilter)).toHaveBeenCalledWith(
				'auth.login',
				{ passkey: true, mode: 'session' },
				expect.objectContaining({ status: 'pending', provider: 'default' }),
				expect.any(Object),
			);
		});

		const refused = async (response: any = assertion()) => {
			await expect(service.login(response, 'json')).rejects.toBeInstanceOf(InvalidCredentialsError);
			expect(stall).toHaveBeenCalledWith(500, expect.any(Number));
			expect(finish).not.toHaveBeenCalled();

			expect(vi.mocked(emitter.emitAction)).toHaveBeenCalledWith(
				'auth.login',
				expect.objectContaining({ status: 'fail', provider: 'default', payload: { passkey: true, mode: 'json' } }),
				expect.any(Object),
			);
		};

		test('no, used or register challenge: generic error, nothing counted', async () => {
			vi.mocked(takeChallenge).mockResolvedValue(undefined);
			await refused();

			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'register', user: USER, expires: Date.now() + 1000 });
			await refused();

			await refused({ ...assertion(), response: { clientDataJSON: 'not-json' } });
			expect(consume).not.toHaveBeenCalled();
		});

		test('unknown credential or orphan row: generic error, nothing counted', async () => {
			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'login', expires: Date.now() + 1000 });

			tracker.on.select('backoffice_passkeys').responseOnce([]);
			await refused();

			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.select('directus_users').responseOnce([]);
			await refused();

			expect(consume).not.toHaveBeenCalled();
		});

		test('inactive or non-local user: refused before the limiter, not counted (H1)', async () => {
			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'login', expires: Date.now() + 1000 });

			for (const over of [{ status: 'invited' }, { status: 'suspended' }, { provider: 'ldap' }]) {
				tracker.on.select('backoffice_passkeys').responseOnce([row()]);
				tracker.on.select('directus_users').responseOnce([user(over)]);
				await refused();
			}

			expect(consume).not.toHaveBeenCalled();
		});

		test('failed verification (signature, counter, UV): generic error, counted', async () => {
			vi.mocked(takeChallenge).mockResolvedValue({ purpose: 'login', expires: Date.now() + 1000 });
			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.select('directus_users').responseOnce([user()]);
			vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error('counter lower than expected'));
			await refused();

			tracker.on.select('backoffice_passkeys').responseOnce([row()]);
			tracker.on.select('directus_users').responseOnce([user()]);
			vi.mocked(verifyAuthenticationResponse).mockResolvedValue({ verified: false, authenticationInfo: {} } as any);
			await refused();

			expect(consume).toHaveBeenCalledTimes(2);
			expect(tracker.history.update).toHaveLength(0);
		});

		test('passkeys off (no RP): not found', async () => {
			vi.mocked(getPasskeyRp).mockReturnValue(null);
			await expect(service.loginOptions()).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
		});
	});
});
