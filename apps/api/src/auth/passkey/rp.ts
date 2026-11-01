// Backoffice (spec 029, FR-026, FR-027, research R5): the WebAuthn relying party of passkey login. The RP ID is the
// host name of PUBLIC_URL and the only accepted origin is the origin of PUBLIC_URL (clarify 2026-11-01, question 1).
// No absolute PUBLIC_URL, or an IP address host (browsers refuse it), turns passkeys off: every passkey route answers 404.
import { isIP } from 'node:net';
import { useEnv } from '@backoffice/env';

export const PASSKEY_DISABLED_WARNING =
	'Passkey login is disabled: "PUBLIC_URL" must be an absolute URL with a host name (not an IP address)';

export interface PasskeyRp {
	rpId: string;
	origin: string;
}

export function getPasskeyRp(publicUrl: unknown = useEnv()['PUBLIC_URL']): PasskeyRp | null {
	if (typeof publicUrl !== 'string') return null;

	let url: URL;

	try {
		url = new URL(publicUrl);
	} catch {
		return null;
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.hostname.replace(/^\[|\]$/g, '');
	if (!host || isIP(host) !== 0) return null;

	return { rpId: host, origin: url.origin };
}
