<!-- Ported from directus/app/src/routes/accept-invite.vue -->
<script setup lang="ts">
// Backoffice: fields have visible labels (FR-067) and the password autocomplete is new-password (Directus: password);
// a token that is not a JWT leaves the email empty instead of throwing while rendering, the form still posts and the
// API error shows with a line telling to ask an administrator for a new link, as the system sends no email (FR-052,
// D-42); requests go through the SDK.
import { useHead } from '@unhead/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import BoInput from '../components/BoInput.vue';
import BoNotice from '../components/BoNotice.vue';
import { type APIError, translateAPIError } from '../lang/index.ts';
import PublicView from '../layout/PublicView.vue';
import { jwtPayload } from '../utils/jwt-payload.ts';

const { t } = useI18n();

const route = useRoute();

const acceptToken = computed(() => route.query['token'] as string | undefined);

const password = ref<string | null>(null);

const creating = ref(false);
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
		return jwtPayload(acceptToken.value ?? '').email ?? null;
	} catch {
		return null;
	}
});

async function onSubmit() {
	creating.value = true;
	error.value = null;

	try {
		await sdk.request(
			requestEndpoint('/users/invite/accept', {
				method: 'POST',
				body: {
					password: password.value,
					token: acceptToken.value,
				},
			}),
		);

		done.value = true;
	} catch (err: any) {
		error.value = err;
	} finally {
		creating.value = false;
	}
}

useHead({
	title: t('create_account'),
});
</script>

<template>
	<PublicView>
		<h1 class="mb-5 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90 sm:mb-8">
			{{ $t('create_account') }}
		</h1>

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

			<BoNotice v-if="done" type="success">{{ $t('account_created_successfully') }}</BoNotice>

			<BoNotice v-if="error" type="danger">
				<p>{{ errorFormatted }}</p>
				<p class="mt-1">{{ $t('contact_admin_for_link') }}</p>
			</BoNotice>

			<div>
				<BoButton v-if="!done" type="submit" full-width :loading="creating">{{ $t('create') }}</BoButton>
				<BoButton v-else full-width :to="signInLink">{{ $t('sign_in') }}</BoButton>
			</div>
		</form>

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
