<!-- Ported from directus/app/src/routes/shared/shared.vue -->
<script setup lang="ts">
// Backoffice: only the sign-in part. Once signed in (or already signed in as this share or as a user) the app opens
// the item page of the Content module (feature 014) in the share session, instead of the read-only form of share-item.vue;
// the page is a PublicView instead of shared-view.vue and the title does not read the collection name (the
// collections store is empty before sign-in). A wrong password is read from the SDK error (`errors`, the Directus
// app reads `response.data.errors`, an axios shape) and shown under the field; other errors in a danger notice.
import { readMe } from '@directus/sdk';
import { useHead } from '@unhead/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { login, logout } from '../auth.ts';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import BoInput from '../components/BoInput.vue';
import BoNotice from '../components/BoNotice.vue';
import BoProgressCircular from '../components/BoProgressCircular.vue';
import { type APIError, translateAPIError } from '../lang/index.ts';
import PublicView from '../layout/PublicView.vue';
import { useAppStore } from '../stores/app.ts';
import { getItemRoute } from '../utils/get-item-route.ts';

type ShareInfo = {
	id: string;
	collection: string;
	item: string;
	password: string | null;
	date_start: string | null;
	date_end: string | null;
	max_uses: number | null;
	times_used: number;
};

const { t } = useI18n();

const appStore = useAppStore();

const loading = ref(true);
const authenticating = ref(false);

const notFound = ref(false);

const error = ref<APIError | null>(null);

const router = useRouter();
const route = useRoute();

const shareId = route.params['id'] as string;
const share = ref<ShareInfo>();

const usesLeft = ref<number | null>(null);

const usesLeftNoticeType = computed(() => {
	if (!usesLeft.value) return 'info';
	if (usesLeft.value < 3) return 'warning';
	return 'info';
});

const password = ref<string | null>(null);
const passwordWrong = ref(false);

getShareInformation(shareId);

const title = computed(() => {
	if (notFound.value) return t('share_access_not_found_title');
	return t('share_access_page');
});

async function getShareInformation(shareId: string) {
	loading.value = true;

	try {
		share.value = await sdk.request<ShareInfo>(requestEndpoint(`/shares/info/${shareId}`));

		if (!share.value) {
			notFound.value = true;
			loading.value = false;
			return;
		}

		const { max_uses, times_used } = share.value;

		if (max_uses) {
			usesLeft.value = max_uses - times_used;
		}

		await handleAuth();
	} catch (err: any) {
		if (err?.response?.status === 404 || err?.response?.status === 403) {
			notFound.value = true;
		} else {
			error.value = err;
		}
	} finally {
		loading.value = false;
	}
}

async function handleAuth() {
	if (appStore.authenticated) {
		const currentUser = await sdk.request<{ id?: string; share?: string }>(readMe({ fields: ['id'] }));

		if (currentUser?.share) {
			if (currentUser.share !== shareId) {
				await logout({ navigate: false });
			} else {
				// Backoffice: signed in as this share, open its item route (Directus hydrates and shows share-item.vue).
				router.replace(getItemRoute(share.value!.collection, share.value!.item));
				return;
			}
		}

		// Logged in as regular user
		if (currentUser?.id && !currentUser?.share) {
			router.replace(getItemRoute(share.value!.collection, share.value!.item));
			return;
		}
	}

	if (!share.value?.password && !share.value?.max_uses) {
		await authenticate();
	}
}

async function authenticate() {
	authenticating.value = true;
	passwordWrong.value = false;

	try {
		const credentials = { share: shareId, ...(password.value !== null && { password: password.value }) };
		await login({ share: true, credentials });
		// Backoffice: replace, so Back does not reopen the sign-in of the share (FR-084).
		router.replace(getItemRoute(share.value!.collection, share.value!.item));
	} catch (err: any) {
		if (err?.errors?.[0]?.extensions?.code === 'INVALID_CREDENTIALS') {
			passwordWrong.value = true;
			return;
		}

		error.value = err;
	} finally {
		authenticating.value = false;
	}
}

useHead({ title });
</script>

<template>
	<PublicView>
		<h1 class="mb-5 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90 sm:mb-8">
			{{ title }}
		</h1>

		<BoProgressCircular
			v-if="loading"
			indeterminate
			:aria-label="$t('loading')"
			class="text-2xl text-brand-500 dark:text-brand-400"
		/>

		<p v-else-if="notFound">
			<strong>{{ $t('share_access_not_found') }}</strong>
			{{ $t('share_access_not_found_desc') }}
		</p>

		<BoNotice v-else-if="error" type="danger">{{ translateAPIError(error) }}</BoNotice>

		<form v-else-if="share" novalidate class="flex flex-col gap-5" @submit.prevent="authenticate">
			<BoNotice v-if="usesLeft !== null" :type="usesLeftNoticeType">
				{{ $t('shared_uses_left', usesLeft) }}
			</BoNotice>

			<template v-if="usesLeft !== 0">
				<BoInput
					v-if="share.password"
					v-model="password"
					type="password"
					name="password"
					autocomplete="current-password"
					autofocus
					:label="$t('password')"
					:placeholder="$t('shared_enter_passcode')"
					:error="passwordWrong ? translateAPIError('INVALID_CREDENTIALS') : ''"
				/>
				<div>
					<BoButton type="submit" full-width :loading="authenticating">
						{{ $t('share_access_page') }}
					</BoButton>
				</div>
			</template>
		</form>

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
