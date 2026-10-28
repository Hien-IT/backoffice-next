<!-- Ported from directus/app/src/routes/login/components/login-form/login-form.vue -->
<script setup lang="ts">
// Backoffice: fields have visible labels (FR-067); errors show in a danger BoNotice (role=alert) instead of a warning
// notice; the email check is a plain pattern instead of zod (not a dependency of the app). Owner 2026-10-29: no "Forgot
// Password" link under the button (DR links /reset-password; the route stays).
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../auth.ts';
import BoButton from '../../components/BoButton.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import { DEFAULT_AUTH_PROVIDER } from '../../constants.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useUserStore } from '../../stores/user.ts';

type Credentials = {
	email: string;
	password: string;
	otp?: string;
};

const { provider = DEFAULT_AUTH_PROVIDER } = defineProps<{
	provider?: string;
}>();

// shortcut: not a full RFC 5322 check (DR uses z.email()), only to skip requests for clearly invalid values.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = useRouter();

const loggingIn = ref(false);
const email = ref<string | null>(null);
const password = ref<string | null>(null);
const error = ref<APIError | null>(null);
const otp = ref<string | null>(null);
const requiresTFA = ref(false);
const userStore = useUserStore();

watch(email, () => {
	if (requiresTFA.value === true) requiresTFA.value = false;
});

watch(
	() => provider,
	() => {
		email.value = null;
		password.value = null;
		error.value = null;
		otp.value = null;
		requiresTFA.value = false;
	},
);

const errorFormatted = computed(() => {
	// Show "Wrong username or password" for wrongly formatted emails as well
	if (error.value === 'INVALID_PAYLOAD') {
		return translateAPIError('INVALID_CREDENTIALS');
	}

	if (error.value) {
		return translateAPIError(error.value);
	}

	return null;
});

async function onSubmit() {
	// Simple RegEx, not for validation, but to prevent unnecessary login requests when the value is clearly invalid
	if (!EMAIL_PATTERN.test(email.value ?? '') || password.value === null) {
		error.value = 'INVALID_PAYLOAD';
		return;
	}

	try {
		loggingIn.value = true;

		const credentials: Credentials = {
			email: email.value!,
			password: password.value,
		};

		if (otp.value) {
			credentials.otp = otp.value;
		}

		await login({ provider, credentials });

		const redirectQuery = router.currentRoute.value.query['redirect'] as string | undefined;

		let lastPage: string | null = null;

		if (userStore.currentUser && 'last_page' in userStore.currentUser) {
			lastPage = userStore.currentUser.last_page;
		}

		router.push(redirectQuery || lastPage || '/content');
	} catch (err: any) {
		if (err?.errors?.[0]?.extensions?.code === 'INVALID_OTP' && requiresTFA.value === false) {
			requiresTFA.value = true;
			error.value = null;
		} else {
			error.value = err?.errors?.[0]?.extensions?.code || err;
		}
	} finally {
		loggingIn.value = false;
	}
}
</script>

<template>
	<form novalidate class="flex flex-col gap-5" @submit.prevent="onSubmit">
		<BoInput v-model="email" autofocus autocomplete="username" type="email" name="email" :label="$t('email')" />
		<BoInput
			v-model="password"
			autocomplete="current-password"
			type="password"
			name="password"
			:label="$t('password')"
		/>
		<BoInput
			v-if="requiresTFA"
			v-model="otp"
			type="text"
			name="otp"
			autocomplete="one-time-code"
			inputmode="numeric"
			:maxlength="6"
			:label="$t('otp')"
			autofocus
		/>
		<BoNotice v-if="error" type="danger">
			{{ errorFormatted }}
		</BoNotice>
		<BoButton type="submit" full-width :loading="loggingIn">
			{{ $t('sign_in') }}
		</BoButton>
	</form>
</template>
