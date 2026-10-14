<!-- Ported from directus/app/src/routes/login/components/login-form/ldap-form.vue -->
<script setup lang="ts">
// Backoffice: fields have visible labels instead of placeholders (FR-067); errors show in a danger BoNotice
// (role=alert) instead of a warning notice; INVALID_OTP clears the previous error like LoginForm.
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../../auth.ts';
import BoButton from '../../components/BoButton.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { useUserStore } from '../../stores/user.ts';

type Credentials = {
	identifier: string;
	password: string;
	otp?: string;
};

const { provider } = defineProps<{
	provider: string;
}>();

const router = useRouter();

const loggingIn = ref(false);
const identifier = ref<string | null>(null);
const password = ref<string | null>(null);
const error = ref<APIError | null>(null);
const otp = ref<string | null>(null);
const requiresTFA = ref(false);
const userStore = useUserStore();

watch(identifier, () => {
	if (requiresTFA.value === true) requiresTFA.value = false;
});

watch(
	() => provider,
	() => {
		identifier.value = null;
		password.value = null;
		error.value = null;
		otp.value = null;
		requiresTFA.value = false;
	},
);

const errorFormatted = computed(() => {
	if (error.value === 'INVALID_PAYLOAD') {
		return translateAPIError('INVALID_CREDENTIALS');
	}

	if (error.value) {
		return translateAPIError(error.value);
	}

	return null;
});

async function onSubmit() {
	if (identifier.value === null || password.value === null) return;

	try {
		loggingIn.value = true;

		const credentials: Credentials = {
			identifier: identifier.value,
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
		<BoInput v-model="identifier" autofocus autocomplete="username" name="identifier" :label="$t('identifier')" />
		<BoInput
			v-model="password"
			type="password"
			autocomplete="current-password"
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
		<div>
			<BoButton type="submit" full-width :loading="loggingIn">
				{{ $t('sign_in') }}
			</BoButton>
		</div>
	</form>
</template>
