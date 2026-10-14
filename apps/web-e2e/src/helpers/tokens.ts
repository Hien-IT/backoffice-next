// Invite and password-reset tokens for the specs (research R9): neither app sends mail in the parity environment, so the
// specs sign the same JWT the API would have mailed, with the SECRET of the env file. Payloads and options as in
// directus/api/src/services/users.ts 11.17.4: inviteUrl() (`{ email, scope: 'invite' }`, USER_INVITE_TOKEN_TTL = '7d',
// issuer 'directus') and requestPasswordReset() (`{ email, scope: 'password-reset', hash }`, '1d', issuer 'directus').
import jwt from 'jsonwebtoken';
import { SECRET } from './config.js';

/**
 * Port of getSimpleHash() of directus/packages/utils/shared/get-simple-hash.ts 11.17.4 (not cryptographic).
 */
export function getSimpleHash(str: string): string {
	let hash = 0;

	for (let i = 0; i < str.length; hash &= hash) {
		hash = 31 * hash + str.charCodeAt(i++);
	}

	return Math.abs(hash).toString(16);
}

export function inviteToken(email: string, secret = SECRET): string {
	return jwt.sign({ email, scope: 'invite' }, secret, { expiresIn: '7d', issuer: 'directus' });
}

/**
 * `passwordHash` is the stored `directus_users.password` (the argon2 hash, read with db-rows' hostDb()): Directus hashes
 * `'' + user.password` of the row, not the clear password, so a token stops working once the password changes.
 */
export function passwordResetToken(email: string, passwordHash: string | null, secret = SECRET): string {
	const hash = getSimpleHash('' + passwordHash);
	return jwt.sign({ email, scope: 'password-reset', hash }, secret, { expiresIn: '1d', issuer: 'directus' });
}
