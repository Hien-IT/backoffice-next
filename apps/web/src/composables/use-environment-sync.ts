// Backoffice (spec 032, D-214.1, contracts/web.md): GET /backoffice/sync answers the instance info at Backoffice and
// 404s at DR, so it is the probe that shows the Environment Sync entry of Settings (one probe per API URL for the app
// session, like the probes of 029 and 031).
import { type Ref, ref } from 'vue';
import { apiFetch, getApiUrl } from '../api/sdk.ts';

const available = ref(false);
let probe: { api: string; done: Promise<boolean> } | null = null;

async function check(): Promise<boolean> {
	try {
		return (await apiFetch('/backoffice/sync', { method: 'GET' })).ok;
	} catch {
		return false;
	}
}

export function useEnvironmentSync(): { available: Ref<boolean>; ready: Promise<boolean> } {
	const api = getApiUrl();

	if (!probe || probe.api !== api) {
		const done = check().then((value) => (available.value = value));
		probe = { api, done };
	}

	return { available, ready: probe.done };
}

/** @internal Reset between tests. */
export function _resetEnvironmentSync(): void {
	probe = null;
	available.value = false;
}
