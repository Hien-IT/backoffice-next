<!-- Ported from directus/app/src/routes/reset-password/request.vue -->
<script setup lang="ts">
// Backoffice: the email field has a visible label (FR-067); the sent notice has a second line telling to ask an
// administrator for the link, as the system sends no email (FR-052, D-42); requests go through the SDK.
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import { type APIError, translateAPIError } from '../../lang/index.ts';

const email = ref<string | null>(null);

const sending = ref(false);
const error = ref<APIError | null>(null);
const done = ref(false);

const errorFormatted = computed(() => {
	if (error.value) {
		return translateAPIError(error.value);
	}

	return null;
});

const signInLink = computed(() => `/login`);

async function onSubmit() {
	sending.value = true;
	error.value = null;

	try {
		await sdk.request(
			requestEndpoint('/auth/password/request', {
				method: 'POST',
				body: {
					email: email.value,
				},
			}),
		);

		done.value = true;
	} catch (err: any) {
		error.value = err;
	} finally {
		sending.value = false;
	}
}
</script>

<template>
	<form novalidate class="flex flex-col gap-5" @submit.prevent="onSubmit">
		<BoInput v-model="email" autofocus autocomplete="username" type="email" name="email" :label="$t('email')" />
		<BoNotice v-if="done" type="success">
			<p>{{ $t('password_reset_sent') }}</p>
			<p class="mt-1">{{ $t('contact_admin_for_link') }}</p>
		</BoNotice>
		<BoNotice v-if="error" type="danger">
			{{ errorFormatted }}
		</BoNotice>
		<div class="flex flex-col items-center gap-5">
			<BoButton type="submit" full-width :loading="sending">{{ $t('reset') }}</BoButton>
			<RouterLink
				:to="signInLink"
				class="rounded-sm text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			>
				{{ $t('sign_in') }}
			</RouterLink>
		</div>
	</form>
</template>
