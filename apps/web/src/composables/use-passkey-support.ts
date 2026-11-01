// Backoffice (spec 029, D-207.4, FR-001, contracts/web.md): whether passkeys can be used here. True when the browser has
// WebAuthn, the API is Backoffice (GET /backoffice/auth/passkey answers; DR 404s) and the RP ID it gives is the host
// name of this page (a web app on another host than the API cannot use them, clarify 2026-11-01 question 1).
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { type Ref, ref } from 'vue';
import { apiFetch, getApiUrl } from '../api/sdk.ts';

const available = ref(false);
let probe: { api: string; done: Promise<boolean> } | null = null;

async function check(): Promise<boolean> {
	if (!browserSupportsWebAuthn()) return false;

	try {
		const res = await apiFetch('/backoffice/auth/passkey', { method: 'GET' });
		if (!res.ok) return false;
		const body = (await res.json()) as { data?: { rp_id?: string } };
		return body.data?.rp_id === window.location.hostname;
	} catch {
		return false;
	}
}

/** One probe per API URL for the whole app session; an error or a 404 means no passkeys, silently. */
export function usePasskeySupport(): { passkeyAvailable: Ref<boolean>; ready: Promise<boolean> } {
	const api = getApiUrl();

	if (!probe || probe.api !== api) {
		const done = check().then((value) => (available.value = value));
		probe = { api, done };
	}

	return { passkeyAvailable: available, ready: probe.done };
}

/** @internal Reset between tests. */
export function _resetPasskeySupport(): void {
	probe = null;
	available.value = false;
}
