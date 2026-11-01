// Spec 029 (research R10, T046): a CDP virtual authenticator for the passkey specs, chromium only. It holds discoverable
// credentials with user verification, like a platform authenticator (Touch ID, Windows Hello), and answers the
// browser dialog by itself. With no credential for the RP ID it answers NotAllowedError, like a cancelled dialog.
import type { CDPSession, Page } from '@playwright/test';

export interface VirtualAuthenticator {
	cdp: CDPSession;
	authenticatorId: string;
	credentialCount(): Promise<number>;
}

export async function addVirtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');

	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	});

	return {
		cdp,
		authenticatorId,
		async credentialCount() {
			return (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials.length;
		},
	};
}
