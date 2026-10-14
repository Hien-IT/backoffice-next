<!-- Ported from directus/app/src/routes/login/components/continue-as.vue -->
<script setup lang="ts">
// Backoffice: /users/me through the SDK; a failed request shows a notice (the app has no unexpectedError helper).
import { onMounted, ref } from 'vue';
import { I18nT } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { logout } from '../../auth.ts';
import BoButton from '../../components/BoButton.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoProgressCircular from '../../components/BoProgressCircular.vue';
import { hydrate } from '../../hydrate.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import type { AppUser } from '../../types/user.ts';
import { userName } from '../../utils/user-name.ts';

const router = useRouter();

const loading = ref(false);
const name = ref<string | null>(null);
const lastPage = ref<string | null>(null);
const error = ref<APIError | null>(null);

const userPromise = fetchUser();

onMounted(() => {
	if ('continue' in router.currentRoute.value.query) {
		hydrateAndLogin();
	}
});

async function fetchUser() {
	loading.value = true;

	try {
		const user = await sdk.request(
			requestEndpoint<Partial<AppUser> & { share?: string }>('/users/me', {
				method: 'GET',
				params: { fields: ['email', 'first_name', 'last_name', 'last_page'] },
			}),
		);

		if (user.share) {
			await logout();
		}

		name.value = userName(user);
		lastPage.value = user.last_page ?? null;
	} catch (err: any) {
		error.value = err;
	} finally {
		loading.value = false;
	}
}

async function hydrateAndLogin() {
	await hydrate();
	await userPromise;
	const redirectQuery = router.currentRoute.value.query['redirect'] as string | undefined;
	router.push(redirectQuery || lastPage.value || `/content`);
}
</script>

<template>
	<div>
		<BoProgressCircular
			v-if="loading"
			indeterminate
			:aria-label="$t('loading')"
			class="text-eh-2xl text-eh-action-primary"
		/>
		<template v-else>
			<BoNotice v-if="error" type="danger" class="mb-eh-4">{{ translateAPIError(error) }}</BoNotice>
			<I18nT keypath="continue_as" scope="global" tag="p" class="mb-eh-6">
				<template #name>
					<b class="font-semibold">{{ name }}</b>
				</template>
			</I18nT>
			<div class="flex items-center justify-between gap-eh-4">
				<RouterLink to="/logout" class="text-eh-text-secondary transition-colors hover:text-eh-text-primary">
					{{ $t('sign_out') }}
				</RouterLink>
				<BoButton @click="hydrateAndLogin">{{ $t('continue_label') }}</BoButton>
			</div>
		</template>
	</div>
</template>
