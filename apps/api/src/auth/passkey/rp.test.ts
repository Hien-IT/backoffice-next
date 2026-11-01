// Backoffice (spec 029, FR-026, research R5): the passkey relying party comes from PUBLIC_URL only.
import { useEnv } from '@backoffice/env';
import { afterEach, expect, test, vi } from 'vitest';
import { getPasskeyRp } from './rp.js';

vi.mock('@backoffice/env');

afterEach(() => {
	vi.clearAllMocks();
});

const rpFor = (PUBLIC_URL: unknown) => {
	vi.mocked(useEnv).mockReturnValue({ PUBLIC_URL } as any);
	return getPasskeyRp();
};

test('a relative or missing PUBLIC_URL turns passkeys off', () => {
	expect(rpFor('/')).toBeNull();
	expect(rpFor(undefined)).toBeNull();
	expect(rpFor('not a url')).toBeNull();
});

test('an IP address host turns passkeys off (browsers refuse an IP as RP ID, research T002)', () => {
	expect(rpFor('http://127.0.0.1:8056')).toBeNull();
	expect(rpFor('https://[::1]:8443')).toBeNull();
	expect(rpFor('http://10.0.0.7')).toBeNull();
});

test('the RP ID is the host name without port or path; the origin keeps the port', () => {
	expect(rpFor('https://bo.example.com/x/')).toEqual({ rpId: 'bo.example.com', origin: 'https://bo.example.com' });
	expect(rpFor('http://localhost:8091')).toEqual({ rpId: 'localhost', origin: 'http://localhost:8091' });
});
