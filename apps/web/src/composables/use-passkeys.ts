// Backoffice (spec 029, D-207.4, contracts/api.md, contracts/web.md): the passkeys of a user. For oneself: list, add
// (password, then the browser dialog, then a name), rename, delete; for another user (admin): list and delete.
import {
	type PublicKeyCredentialCreationOptionsJSON,
	type RegistrationResponseJSON,
	startRegistration,
} from '@simplewebauthn/browser';
import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';

export const MAX_PASSKEYS = 10;

export interface Passkey {
	id: string;
	name: string;
	date_created: string | null;
	last_used: string | null;
	device_type: string | null;
	backed_up: boolean;
	transports: string[] | null;
}

/** The browser dialog was cancelled or timed out: nothing to report (FR-008). */
export function isPasskeyCancel(error: unknown): boolean {
	const name = (error as { name?: string } | null)?.name;
	return name === 'NotAllowedError' || name === 'AbortError';
}

export function usePasskeys(userId: MaybeRefOrGetter<string>, isCurrentUser: MaybeRefOrGetter<boolean>) {
	const passkeys = ref<Passkey[]>([]);
	const loading = ref(false);
	const error = ref<unknown>(null);

	const base = computed(() =>
		toValue(isCurrentUser) ? '/backoffice/users/me/passkeys' : `/backoffice/users/${toValue(userId)}/passkeys`,
	);

	const atLimit = computed(() => passkeys.value.length >= MAX_PASSKEYS);

	async function load(): Promise<void> {
		loading.value = true;

		try {
			passkeys.value = await sdk.request(requestEndpoint<Passkey[]>(base.value, { method: 'GET' }));
			error.value = null;
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Step one of adding (own passkeys only): the password opens the registration, then the browser dialog. Resolves the
	 * browser answer to save, or null when the dialog was cancelled; API errors (wrong password, limit) throw.
	 */
	async function begin(password: string): Promise<RegistrationResponseJSON | null> {
		const optionsJSON = await sdk.request(
			requestEndpoint<PublicKeyCredentialCreationOptionsJSON>('/backoffice/users/me/passkeys/options', {
				method: 'POST',
				body: { password },
			}),
		);

		try {
			return await startRegistration({ optionsJSON });
		} catch (err) {
			if (isPasskeyCancel(err)) return null;
			throw err;
		}
	}

	async function save(response: RegistrationResponseJSON, name: string): Promise<Passkey> {
		const created = await sdk.request(
			requestEndpoint<Passkey>('/backoffice/users/me/passkeys', { method: 'POST', body: { response, name } }),
		);

		passkeys.value = [...passkeys.value, created];
		return created;
	}

	async function rename(id: string, name: string): Promise<void> {
		const updated = await sdk.request(
			requestEndpoint<Passkey>(`/backoffice/users/me/passkeys/${id}`, { method: 'PATCH', body: { name } }),
		);

		passkeys.value = passkeys.value.map((p) => (p.id === id ? updated : p));
	}

	async function remove(id: string): Promise<void> {
		await sdk.request(requestEndpoint(`${base.value}/${id}`, { method: 'DELETE' }));
		passkeys.value = passkeys.value.filter((p) => p.id !== id);
	}

	return { passkeys, loading, error, atLimit, load, begin, save, rename, remove };
}
