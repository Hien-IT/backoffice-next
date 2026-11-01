// Backoffice (spec 029, FR-025, research R4): the pending WebAuthn challenges. A challenge is the key (32 random bytes
// from the library, base64url), used once even when two replicas receive it at the same time (Redis GETDEL), and
// expires after five minutes. Without Redis (one instance) a bounded Map holds them, like the memory rate limiter.
import { ServiceUnavailableError } from '@backoffice/errors';
import { redisConfigAvailable, useRedis } from '../../redis/index.js';

export const CHALLENGE_TTL = 5 * 60 * 1000;
export const MAX_LOCAL = 10_000;
const PREFIX = 'backoffice:passkey:';

export interface PendingChallenge {
	purpose: 'login' | 'register';
	/** The user who confirmed the password (registration only). */
	user?: string;
	expires: number;
}

/** In-process store when Redis is not configured; exported for tests. */
export const _local = new Map<string, PendingChallenge>();

const unavailable = (error: unknown) =>
	new ServiceUnavailableError({ service: 'passkey', reason: `Challenge store unreachable: ${String(error)}` });

export async function putChallenge(challenge: string, pending: Omit<PendingChallenge, 'expires'>): Promise<void> {
	const value: PendingChallenge = { ...pending, expires: Date.now() + CHALLENGE_TTL };

	if (redisConfigAvailable()) {
		try {
			await useRedis().set(PREFIX + challenge, JSON.stringify(value), 'PX', CHALLENGE_TTL);
		} catch (error) {
			throw unavailable(error);
		}

		return;
	}

	// Map keeps insertion order: drop the oldest when full.
	if (_local.size >= MAX_LOCAL) _local.delete(_local.keys().next().value!);
	_local.set(challenge, value);
}

/** Takes and deletes the challenge in one step; undefined when unknown, used or expired. */
export async function takeChallenge(challenge: string): Promise<PendingChallenge | undefined> {
	let value: PendingChallenge | undefined;

	if (redisConfigAvailable()) {
		let raw: string | null;

		try {
			raw = await useRedis().getdel(PREFIX + challenge);
		} catch (error) {
			throw unavailable(error);
		}

		value = raw ? (JSON.parse(raw) as PendingChallenge) : undefined;
	} else {
		// Read and delete in the same tick: no await in between, so a second caller finds nothing.
		value = _local.get(challenge);
		_local.delete(challenge);
	}

	if (!value || value.expires < Date.now()) return undefined;
	return value;
}
