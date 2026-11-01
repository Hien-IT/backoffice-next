// Backoffice (spec 029, D-207, research R3): passkey (WebAuthn) registration, management and login for local users.
// Rows live in backoffice_passkeys (migration 20261101A), read and written with Knex: no directus_fields, no policy
// permissions, no activity of their own (like directus_sessions). The login ends in AuthenticationService.finishLogin,
// so the session, cookie, activity and auth.login events are those of a local login.
import { randomUUID } from 'node:crypto';
import { performance } from 'perf_hooks';
import { useEnv } from '@backoffice/env';
import { ForbiddenError, InvalidCredentialsError, InvalidPayloadError, RouteNotFoundError } from '@backoffice/errors';
import type { AbstractServiceOptions, Accountability, LoginResult, SchemaOverview } from '@backoffice/types';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { Knex } from 'knex';
import { CHALLENGE_TTL, putChallenge, takeChallenge } from '../auth/passkey/challenge-store.js';
import { getPasskeyRp, type PasskeyRp } from '../auth/passkey/rp.js';
import { DEFAULT_AUTH_PROVIDER } from '../constants.js';
import getDatabase from '../database/index.js';
import emitter from '../emitter.js';
import { useLogger } from '../logger/index.js';
import type { AuthenticationMode, User } from '../types/index.js';
import { stall } from '../utils/stall.js';
import { AuthenticationService, type LoginStatusEmitter } from './authentication.service.js';

export const TABLE = 'backoffice_passkeys';
export const MAX_PASSKEYS = 10;
const MAX_CREDENTIAL_ID = 255;
const MAX_NAME = 100;

/** A passkey as the API returns it: never the credential id, public key or counter. */
export interface PasskeyItem {
	id: string;
	name: string;
	date_created: string | null;
	last_used: string | null;
	device_type: string | null;
	backed_up: boolean;
	transports: string[] | null;
}

type PasskeyRow = Record<string, any>;
type LoginUser = User & { tfa_secret: string | null };

const USER_FIELDS = [
	'id',
	'first_name',
	'last_name',
	'email',
	'password',
	'status',
	'role',
	'tfa_secret',
	'provider',
	'external_identifier',
	'auth_data',
];

const toIso = (value: unknown): string | null => {
	if (value === null || value === undefined) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

/** JSON columns come back as strings on MySQL, SQLite, MSSQL and Oracle. */
const parseTransports = (value: unknown): string[] | null => {
	if (value === null || value === undefined) return null;
	if (Array.isArray(value)) return value as string[];

	try {
		const parsed = JSON.parse(String(value));
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const toItem = (row: PasskeyRow): PasskeyItem => ({
	id: row['id'],
	name: row['name'],
	date_created: toIso(row['date_created']),
	last_used: toIso(row['last_used']),
	device_type: row['device_type'] ?? null,
	backed_up: Boolean(row['backed_up']),
	transports: parseTransports(row['transports']),
});

/** The challenge the browser signed, read from clientDataJSON before the library checks it. */
function signedChallenge(response: { response?: { clientDataJSON?: unknown } } | undefined): string | null {
	try {
		const raw = Buffer.from(String(response?.response?.clientDataJSON ?? ''), 'base64url').toString('utf8');
		const challenge = JSON.parse(raw)?.challenge;
		return typeof challenge === 'string' && challenge.length > 0 ? challenge : null;
	} catch {
		return null;
	}
}

const uuidBytes = (id: string) => Uint8Array.from(Buffer.from(id.replace(/-/g, ''), 'hex'));

export class PasskeyService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.accountability = options.accountability || null;
		this.schema = options.schema;
	}

	private authentication() {
		return new AuthenticationService({ knex: this.knex, accountability: this.accountability, schema: this.schema });
	}

	/** Passkeys off (PUBLIC_URL without a host name): every route answers 404 like DR. */
	private rp(): PasskeyRp {
		const rp = getPasskeyRp();
		if (!rp) throw new RouteNotFoundError({ path: '/backoffice/passkeys' });
		return rp;
	}

	private async readUser(id: string): Promise<LoginUser | undefined> {
		return this.knex.select<LoginUser>(USER_FIELDS).from('directus_users').where('id', id).first();
	}

	/** FR-016: only local users have passkeys. */
	private async localUser(id: string): Promise<LoginUser> {
		const user = await this.readUser(id);
		if (!user || user.provider !== DEFAULT_AUTH_PROVIDER) throw new ForbiddenError();
		return user;
	}

	private rowsOf(user: string): Promise<PasskeyRow[]> {
		return this.knex.select('*').from(TABLE).where({ user }).orderBy('date_created', 'asc');
	}

	private async ownRow(user: string, id: string): Promise<PasskeyRow> {
		const row = await this.knex.select('*').from(TABLE).where({ id }).first();
		// 403 for another user's id or none: the caller learns nothing about other passkeys.
		if (!row || row['user'] !== user) throw new ForbiddenError();
		return row;
	}

	private validName(name: unknown): string {
		const trimmed = typeof name === 'string' ? name.trim() : '';

		if (trimmed.length === 0 || trimmed.length > MAX_NAME) {
			throw new InvalidPayloadError({ reason: `"name" must be 1 to ${MAX_NAME} characters` });
		}

		return trimmed;
	}

	async list(userId: string): Promise<PasskeyItem[]> {
		this.rp();
		await this.localUser(userId);
		return (await this.rowsOf(userId)).map(toItem);
	}

	async listForAdmin(pk: string): Promise<PasskeyItem[]> {
		this.rp();
		const user = await this.readUser(pk);
		if (!user || user.provider !== DEFAULT_AUTH_PROVIDER) return [];
		return (await this.rowsOf(pk)).map(toItem);
	}

	/** FR-011: the current password first, like enabling TFA; then a registration challenge bound to this user. */
	async registrationOptions(userId: string, password: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
		const rp = this.rp();
		const user = await this.localUser(userId);

		await this.authentication().verifyPassword(userId, password);

		const rows = await this.rowsOf(userId);

		if (rows.length >= MAX_PASSKEYS) {
			throw new InvalidPayloadError({ reason: `User already has the maximum of ${MAX_PASSKEYS} passkeys` });
		}

		const settings = await this.knex.select('project_name').from('directus_settings').first();
		const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

		const options = await generateRegistrationOptions({
			rpName: settings?.project_name || 'Backoffice',
			rpID: rp.rpId,
			userName: user.email ?? user.id,
			userDisplayName: displayName || (user.email ?? ''),
			userID: uuidBytes(user.id),
			timeout: CHALLENGE_TTL,
			attestationType: 'none',
			excludeCredentials: rows.map((row) => ({
				id: row['credential_id'],
				transports: parseTransports(row['transports']) ?? undefined,
			})) as { id: string; transports?: any }[],
			authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
		});

		await putChallenge(options.challenge, { purpose: 'register', user: userId });

		return options;
	}

	async register(userId: string, response: RegistrationResponseJSON, name: unknown): Promise<PasskeyItem> {
		const rp = this.rp();
		const passkeyName = this.validName(name);
		await this.localUser(userId);

		const invalid = (reason: string) => new InvalidPayloadError({ reason });
		const challenge = signedChallenge(response);
		const pending = challenge ? await takeChallenge(challenge) : undefined;

		if (!challenge || !pending || pending.purpose !== 'register' || pending.user !== userId) {
			throw invalid('Invalid or expired passkey challenge');
		}

		if ((await this.rowsOf(userId)).length >= MAX_PASSKEYS) {
			throw invalid(`User already has the maximum of ${MAX_PASSKEYS} passkeys`);
		}

		let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;

		try {
			verification = await verifyRegistrationResponse({
				response,
				expectedChallenge: challenge,
				expectedOrigin: rp.origin,
				expectedRPID: rp.rpId,
				requireUserVerification: true,
			});
		} catch (error) {
			// The error name only: library messages can quote the challenge and the origin (FR-007).
			useLogger().debug(`[passkey] registration refused for user ${userId}: ${(error as Error)?.name ?? 'Error'}`);
			throw invalid('Passkey registration could not be verified');
		}

		if (!verification.verified) throw invalid('Passkey registration could not be verified');

		const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

		if (credential.id.length > MAX_CREDENTIAL_ID) throw invalid('Passkey credential id is too long');

		if (await this.knex.select('id').from(TABLE).where({ credential_id: credential.id }).first()) {
			throw invalid('This passkey is already registered');
		}

		const transports = credential.transports ?? response.response?.transports ?? null;

		const row = {
			id: randomUUID(),
			user: userId,
			credential_id: credential.id,
			public_key: Buffer.from(credential.publicKey).toString('base64url'),
			counter: credential.counter,
			// A string: every driver stores it as the JSON of the column (spec 022 note).
			transports: transports ? JSON.stringify(transports) : null,
			name: passkeyName,
			device_type: credentialDeviceType ?? null,
			backed_up: Boolean(credentialBackedUp),
			discoverable: true,
			date_created: new Date(),
			last_used: null,
		};

		await this.knex.insert(row).into(TABLE);
		useLogger().info(`[passkey] user ${userId} added passkey ${row.id}`);

		return toItem(row);
	}

	async rename(userId: string, id: string, name: unknown): Promise<PasskeyItem> {
		this.rp();
		const passkeyName = this.validName(name);
		await this.localUser(userId);
		await this.ownRow(userId, id);
		await this.knex(TABLE).update({ name: passkeyName }).where({ id });
		return toItem(await this.knex.select('*').from(TABLE).where({ id }).first());
	}

	async remove(userId: string, id: string): Promise<void> {
		this.rp();
		await this.localUser(userId);
		await this.ownRow(userId, id);
		await this.knex(TABLE).delete().where({ id });
		useLogger().info(`[passkey] user ${userId} deleted passkey ${id}`);
	}

	/** FR-018: an admin deletes another user's passkey without a password, like disabling that user's TFA. */
	async removeForAdmin(pk: string, id: string): Promise<void> {
		this.rp();
		await this.ownRow(pk, id);
		await this.knex(TABLE).delete().where({ id });
		useLogger().info(`[passkey] admin ${this.accountability?.user ?? ''} deleted passkey ${id} of user ${pk}`);
	}

	async loginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
		const rp = this.rp();

		// Discoverable credentials: no allowCredentials, so nothing tells which users exist.
		const options = await generateAuthenticationOptions({
			rpID: rp.rpId,
			userVerification: 'required',
			allowCredentials: [],
			timeout: CHALLENGE_TTL,
		});

		await putChallenge(options.challenge, { purpose: 'login' });

		return options;
	}

	/**
	 * FR-003..FR-007: every refusal is the local login error after LOGIN_STALL_TIME. A user that is not active or not
	 * local is refused before the auth_login_attempts limiter, like the local login (authentication.service.ts, the
	 * status check before the limiter); a failed signature, counter or user verification counts like a wrong password.
	 */
	async login(response: AuthenticationResponseJSON, mode: AuthenticationMode): Promise<LoginResult> {
		const rp = this.rp();
		const STALL_TIME = useEnv()['LOGIN_STALL_TIME'] as number;
		const timeStart = performance.now();
		const payload = { passkey: true, mode };
		const context = { database: this.knex, schema: this.schema, accountability: this.accountability };

		const emitStatus: LoginStatusEmitter = (status, loginPayload, loginUser, error) => {
			emitter.emitAction(
				'auth.login',
				{ payload: loginPayload, status, user: loginUser?.id, provider: DEFAULT_AUTH_PROVIDER, error },
				context,
			);
		};

		const refuse = async (reason: string, loginPayload: unknown, user?: LoginUser): Promise<never> => {
			const error = new InvalidCredentialsError();
			useLogger().debug(`[passkey] login refused: ${reason}`);
			emitStatus('fail', loginPayload, user, error);
			await stall(STALL_TIME, timeStart);
			throw error;
		};

		const challenge = signedChallenge(response);
		const pending = challenge ? await takeChallenge(challenge) : undefined;
		if (!challenge || pending?.purpose !== 'login') return refuse('unknown, used or expired challenge', payload);

		const row = await this.knex
			.select('*')
			.from(TABLE)
			.where({ credential_id: String(response.id) })
			.first();
		if (!row) return refuse('unknown credential', payload);

		const user = await this.readUser(row['user']);

		const updatedPayload = await emitter.emitFilter(
			'auth.login',
			payload,
			{ status: 'pending', user: user?.id, provider: DEFAULT_AUTH_PROVIDER },
			context,
		);

		if (!user) return refuse('credential of a deleted user', updatedPayload);

		if (user.status !== 'active' || user.provider !== DEFAULT_AUTH_PROVIDER) {
			return refuse('user not active or not local', updatedPayload, user);
		}

		const authentication = this.authentication();
		const allowedAttempts = await authentication.consumeLoginAttempt(user);

		let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;

		try {
			verification = await verifyAuthenticationResponse({
				response,
				expectedChallenge: challenge,
				expectedOrigin: rp.origin,
				expectedRPID: rp.rpId,
				credential: {
					id: row['credential_id'],
					publicKey: Uint8Array.from(Buffer.from(row['public_key'], 'base64url')),
					counter: Number(row['counter']),
					transports: (parseTransports(row['transports']) ?? undefined) as any,
				},
				requireUserVerification: true,
			});
		} catch (error) {
			// The error name only: library messages can quote the challenge and the origin (FR-007).
			return refuse(`verification failed (${(error as Error)?.name ?? 'Error'})`, updatedPayload, user);
		}

		if (!verification.verified) return refuse('verification failed', updatedPayload, user);

		await this.knex(TABLE)
			.update({ counter: verification.authenticationInfo.newCounter, last_used: new Date() })
			.where({ id: row['id'] });

		return authentication.finishLogin(user, updatedPayload, {
			providerName: DEFAULT_AUTH_PROVIDER,
			session: mode === 'session',
			passkey: true,
			allowedAttempts,
			timeStart,
			emitStatus,
		});
	}
}
