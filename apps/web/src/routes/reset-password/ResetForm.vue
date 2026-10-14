<!-- Ported from directus/app/src/routes/reset-password/reset.vue -->
<script setup lang="ts">
// Backoffice: fields have visible labels (FR-067) and the password autocomplete is new-password (Directus: username);
// a token that is not a JWT leaves the email empty instead of throwing while rendering, the API answers the error.
import { computed, ref } from 'vue';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import { jwtPayload } from '../../utils/jwt-payload.ts';

const props = defineProps<{
	token: string;
}>();

const password = ref<string | null>(null);

const resetting = ref(false);
const error = ref<APIError | null>(null);
const done = ref(false);

const errorFormatted = computed(() => {
	if (error.value) {
		return translateAPIError(error.value);
	}

	return null;
});

const signInLink = computed(() => `/login`);

const email = computed<string | null>(() => {
	try {
		return jwtPayload(props.token).email ?? null;
	} catch {
		return null;
	}
});

async function onSubmit() {
	resetting.value = true;
	error.value = null;

	try {
		await sdk.request(
			requestEndpoint('/auth/password/reset', {
				method: 'POST',
				body: {
					password: password.value,
					token: props.token,
				},
			}),
		);

		done.value = true;
	} catch (err: any) {
		error.value = err;
	} finally {
		resetting.value = false;
	}
}
</script>

<template>
	<form novalidate class="flex flex-col gap-5" @submit.prevent="onSubmit">
		<BoInput :model-value="email" type="email" name="email" autocomplete="username" :label="$t('email')" disabled />
		<BoInput
			v-model="password"
			autofocus
			autocomplete="new-password"
			type="password"
			name="password"
			:label="$t('password')"
			:disabled="done"
		/>
		<BoNotice v-if="done" type="success">{{ $t('password_reset_successful') }}</BoNotice>
		<BoNotice v-if="error" type="danger">
			{{ errorFormatted }}
		</BoNotice>
		<div>
			<BoButton v-if="!done" type="submit" full-width :loading="resetting">{{ $t('reset') }}</BoButton>
			<BoButton v-else full-width :to="signInLink">{{ $t('sign_in') }}</BoButton>
		</div>
	</form>
</template>
