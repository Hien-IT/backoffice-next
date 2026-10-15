// Ported from directus/app/src/composables/use-tfa-setup.ts
// Backoffice: requests through the SDK; the QR code is a data URL for an <img> (qrcode.toDataURL) instead of a
// canvas; the localStorage key has the backoffice- prefix (FR-017).
import { useLocalStorage } from '@vueuse/core';
import qrcode from 'qrcode';
import { onMounted, ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { logout } from '../auth.ts';
import { useUserStore } from '../stores/user.ts';

export function useTFASetup(initialEnabled: boolean) {
	const loading = ref(false);
	const password = ref('');
	const tfaEnabled = ref(initialEnabled);
	const tfaGenerated = ref(false);
	const secret = ref<string>();
	const otp = ref('');
	const error = ref<any>();
	const qrCode = ref<string>();

	const userStore = useUserStore();
	const requireTfaSetup = useLocalStorage<string | null>('backoffice-require_tfa_setup', null);

	onMounted(() => {
		password.value = '';
	});

	return {
		generateTFA,
		enableTFA,
		disableTFA,
		adminDisableTFA,
		requestTFASetup,
		cancelTFASetup,
		loading,
		password,
		tfaEnabled,
		tfaGenerated,
		secret,
		otp,
		error,
		qrCode,
		requireTfaSetup,
	};

	async function generateTFA(requiresPassword: boolean = true) {
		if (loading.value === true) return;

		loading.value = true;

		try {
			const payload = requiresPassword ? { password: password.value } : {};

			const data = await sdk.request(
				requestEndpoint<{ secret: string; otpauth_url: string }>('/users/me/tfa/generate', {
					method: 'POST',
					body: payload,
				}),
			);

			const url = data.otpauth_url;
			secret.value = data.secret;
			qrCode.value = await qrcode.toDataURL(url);
			tfaGenerated.value = true;
			error.value = null;
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	async function enableTFA() {
		if (loading.value === true) return;

		loading.value = true;

		let success = false;

		try {
			const payload = { otp: otp.value, secret: secret.value };

			await sdk.request(requestEndpoint('/users/me/tfa/enable', { method: 'POST', body: payload }));
			success = true;
			tfaEnabled.value = true;
			tfaGenerated.value = false;
			password.value = '';
			otp.value = '';
			secret.value = '';
			error.value = null;
			requireTfaSetup.value = null;
			await userStore.hydrate();
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}

		return success;
	}

	async function disableTFA() {
		loading.value = true;
		let success = false;

		try {
			await sdk.request(requestEndpoint('/users/me/tfa/disable', { method: 'POST', body: { otp: otp.value } }));
			success = true;
			await userStore.hydrate();
			tfaEnabled.value = false;
			otp.value = '';
			error.value = null;
			requireTfaSetup.value = null;
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}

		return success;
	}

	async function adminDisableTFA(pk: string) {
		loading.value = true;
		let success = false;

		try {
			await sdk.request(requestEndpoint(`/users/${pk}/tfa/disable`, { method: 'POST' }));
			success = true;
			tfaEnabled.value = false;
			otp.value = '';
			error.value = null;
			const currentUser = userStore.currentUser;

			if (currentUser && !('share' in currentUser) && currentUser.id === pk) {
				requireTfaSetup.value = null;
			}
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}

		return success;
	}

	async function requestTFASetup() {
		if (loading.value === true) return;

		loading.value = true;

		let success = false;

		try {
			const currentUser = userStore.currentUser;
			requireTfaSetup.value = currentUser && !('share' in currentUser) ? currentUser.id : null;
			success = true;
			error.value = null;
			await logout();
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}

		return success;
	}

	async function cancelTFASetup() {
		if (loading.value === true) return;

		loading.value = true;

		let success = false;

		try {
			requireTfaSetup.value = null;
			success = true;
			error.value = null;
			await userStore.hydrate();
		} catch (err: any) {
			error.value = err;
		} finally {
			loading.value = false;
		}

		return success;
	}
}
