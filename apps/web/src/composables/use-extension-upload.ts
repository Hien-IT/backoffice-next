// Backoffice (spec 031, D-212, contracts/web.md): install an extension from an npm-pack tarball. GET
// /backoffice/extensions/upload answers the upload size limit at Backoffice and 404s at DR, so it is also the probe that
// shows the Upload button (one probe per API URL for the app session, like the passkey probe of 029).
import type { ApiOutput } from '@directus/types';
import { type Ref, ref } from 'vue';
import { apiFetch, getApiUrl } from '../api/sdk.ts';

const PATH = '/backoffice/extensions/upload';

const available = ref(false);
const maxUploadSize = ref<number | null>(null);
let probe: { api: string; done: Promise<boolean> } | null = null;

async function check(): Promise<boolean> {
	try {
		const res = await apiFetch(PATH, { method: 'GET' });
		if (!res.ok) return false;
		const body = (await res.json()) as { data?: { max_upload_size?: number | null } };
		maxUploadSize.value = body.data?.max_upload_size ?? null;
		return true;
	} catch {
		return false;
	}
}

/**
 * Sends `file` as the `file` part of a multipart body (the browser sets the boundary). Resolves the installed
 * extension; rejects with `{ errors }` of the API (shape of an SDK error, for translateAPIError and the reason).
 */
async function upload(file: File): Promise<ApiOutput> {
	const form = new FormData();
	form.append('file', file, file.name);

	const res = await apiFetch(PATH, { method: 'POST', body: form });
	const body = (await res.json().catch(() => ({}))) as { data?: ApiOutput; errors?: unknown[] };

	if (!res.ok || !body.data) {
		throw { errors: body.errors ?? [{ message: res.statusText, extensions: { code: 'INTERNAL_SERVER_ERROR' } }], response: res };
	}

	return body.data;
}

export function useExtensionUpload(): {
	available: Ref<boolean>;
	maxUploadSize: Ref<number | null>;
	ready: Promise<boolean>;
	upload: (file: File) => Promise<ApiOutput>;
} {
	const api = getApiUrl();

	if (!probe || probe.api !== api) {
		const done = check().then((value) => (available.value = value));
		probe = { api, done };
	}

	return { available, maxUploadSize, ready: probe.done, upload };
}

/** @internal Reset between tests. */
export function _resetExtensionUpload(): void {
	probe = null;
	available.value = false;
	maxUploadSize.value = null;
}
