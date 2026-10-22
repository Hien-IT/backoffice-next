// Feature 003: tokens the tests make themselves. Neither app sends email, so a password reset token is signed here
// in the Directus format (research R14); OTPs come from the same otplib as both apps.
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { getDbsToTest } from '../get-dbs-to-test.js';

export { decodeJwt } from '../normalizers.js';

/** SECRET of env/<vendor>.env, the one both apps sign with. */
export function sharedSecret(vendor = getDbsToTest()[0]): string {
	const env = readFileSync(new URL(`../../env/${vendor}.env`, import.meta.url), 'utf8');
	const line = env.split('\n').find((l) => l.startsWith('SECRET='));
	if (!line) throw new Error(`No SECRET in env/${vendor}.env`);
	return line.slice('SECRET='.length).trim();
}

/** Copy of getSimpleHash (directus/packages/utils/shared/get-simple-hash.ts), used in the reset token. */
export function getSimpleHash(str: string): string {
	let hash = 0;

	for (let i = 0; i < str.length; hash &= hash) {
		hash = 31 * hash + str.charCodeAt(i++);
	}

	return Math.abs(hash).toString(16);
}

/** Password reset token as UsersService.requestPasswordReset signs it (`passwordHash` from directus_users). */
export function signResetToken(
	email: string,
	passwordHash: string,
	options: { secret?: string; expiresIn?: jwt.SignOptions['expiresIn']; scope?: string } = {},
): string {
	return jwt.sign(
		{ email, scope: options.scope ?? 'password-reset', hash: getSimpleHash('' + passwordHash) },
		options.secret ?? sharedSecret(),
		{ expiresIn: options.expiresIn ?? '1d', issuer: 'directus' },
	);
}

/** Access token signed like AuthenticationService.login, for tests that need a token without logging in. */
export function signAccessToken(
	claims: { id?: string; role: string | null; app_access: boolean; admin_access: boolean; session?: string },
	options: { secret?: string; expiresIn?: jwt.SignOptions['expiresIn'] } = {},
): string {
	return jwt.sign(claims, options.secret ?? sharedSecret(), {
		expiresIn: options.expiresIn ?? '15m',
		issuer: 'directus',
	});
}

/**
 * An OTP with at least 10 s left in its 30 s step. Both apps check it with no window (otplib default), so a code made at
 * the end of a step fails when the login runs in the next one (parity CI 39749104927).
 */
export async function totp(secret: string): Promise<string> {
	const remaining = authenticator.timeRemaining();
	if (remaining < 10) await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
	return authenticator.generate(secret);
}
