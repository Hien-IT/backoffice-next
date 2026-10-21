<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/account/account.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/account/components/account-banner.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/account/components/account-metadata.vue -->
<script setup lang="ts">
// Backoffice (spec 020 US6, recipe Q-43): the banner (64 px avatar, name, verified chip, location and company) and
// the metadata card (bio, npm, GitHub, website links) are inlined; the account's extensions use the Q-42 rows. The
// list request is apiFetch (the SDK drops `meta`); its error, unhandled in Directus, opens the error dialog. The page
// count keeps the Directus Math.round.
import { computed, ref, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import { apiFetch, requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoChip from '../../../../components/BoChip.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoPagination from '../../../../components/BoPagination.vue';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import ExtensionListItem from './components/ExtensionListItem.vue';
import MetadataItem from './components/MetadataItem.vue';
import type { RegistryAccount, RegistryListItem, RegistryListResponse } from './types.ts';
import { registryError } from './utils/registry-error.ts';

const props = defineProps<{
	accountId: string;
}>();

const loading = ref(false);
const error = ref<unknown>(null);
const account = ref<RegistryAccount>();

watchEffect(async () => {
	if (!props.accountId) return;

	loading.value = true;

	try {
		account.value = await sdk.request(
			requestEndpoint<RegistryAccount>(`/extensions/registry/account/${props.accountId}`, { method: 'GET' }),
		);
	} catch (err) {
		error.value = err;
	} finally {
		loading.value = false;
	}
});

const perPage = 6;
const page = ref(1);
const extensions = ref<RegistryListItem[]>([]);
const filterCount = ref(0);
const pageCount = computed(() => Math.round(filterCount.value / perPage));

watchEffect(async () => {
	const params = new URLSearchParams({
		limit: String(perPage),
		offset: String((page.value - 1) * perPage),
		'filter[by][_eq]': props.accountId,
	});

	try {
		const response = await apiFetch(`/extensions/registry?${params}`);
		const data = await response.json();
		if (!response.ok) throw data;

		filterCount.value = (data as RegistryListResponse).meta.filter_count;
		extensions.value = (data as RegistryListResponse).data;
	} catch (err) {
		showUnexpectedError(err);
	}
});

const hasMeta = computed(() => !!account.value?.github_location || !!account.value?.github_company);

const githubLink = computed(() =>
	account.value?.github_username ? 'https://github.com/' + account.value.github_username : undefined,
);

const npmLink = computed(() => 'https://npmjs.org/~' + account.value?.username);

const CARD = 'rounded-2xl border border-gray-200 p-6 dark:border-gray-800';
const SKELETON = 'animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none dark:bg-gray-800';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PrivateView :title="$t('marketplace')" back="/settings/marketplace">
		<template #navigation>
			<SettingsNavigation />
		</template>

		<div v-if="account" class="grid gap-6 xl:grid-cols-[1fr_20rem]">
			<div class="min-w-0 space-y-6">
				<section :class="CARD" class="flex items-center gap-4">
					<img
						v-if="account.github_avatar_url"
						:src="account.github_avatar_url"
						:alt="account.github_name ?? account.username"
						class="size-16 shrink-0 rounded-full"
					/>
					<span
						v-else
						class="flex size-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						<BoIcon name="person" />
					</span>
					<div class="min-w-0 space-y-1">
						<h2
							class="m-0 flex flex-wrap items-center gap-2 text-title-sm font-semibold text-gray-800 dark:text-white/90"
						>
							{{ account.github_name ?? account.username }}
							<BoChip v-if="account.verified" icon="verified" outlined size="sm">{{ $t('verified') }}</BoChip>
						</h2>
						<p v-if="hasMeta" class="m-0 flex flex-wrap gap-4 text-theme-sm text-gray-500 dark:text-gray-400">
							<span v-if="account.github_location" class="flex items-center gap-1">
								<BoIcon name="location_on" size="sm" />
								{{ account.github_location }}
							</span>
							<span v-if="account.github_company" class="flex items-center gap-1">
								<BoIcon name="work" size="sm" />
								{{ account.github_company }}
							</span>
						</p>
					</div>
				</section>

				<ul class="m-0 space-y-2 p-0">
					<ExtensionListItem v-for="extension in extensions" :key="extension.id" :extension="extension" />
				</ul>

				<BoPagination
					v-if="pageCount > 1"
					v-model="page"
					:length="pageCount"
					:total-visible="5"
					:label="$t('marketplace')"
				/>
			</div>

			<div class="space-y-4 self-start rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
				<div v-if="account.github_bio" class="space-y-1">
					<p class="m-0 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">{{ $t('about') }}</p>
					<p class="m-0 text-theme-sm text-gray-700 dark:text-gray-300">{{ account.github_bio }}</p>
				</div>
				<div v-if="account.github_bio" class="h-px bg-gray-200 dark:bg-gray-800" role="separator" />
				<div>
					<MetadataItem v-if="account.username" icon="npm" :href="npmLink" monospace>
						{{ account.username }}
					</MetadataItem>
					<MetadataItem v-if="account.github_username" icon="github" :href="githubLink" monospace>
						{{ account.github_username }}
					</MetadataItem>
					<MetadataItem v-if="account.github_blog" icon="link" :href="account.github_blog">
						{{ $t('website') }}
					</MetadataItem>
				</div>
			</div>
		</div>

		<div v-else-if="loading" class="grid gap-6 xl:grid-cols-[1fr_20rem]" aria-busy="true">
			<div class="h-32" :class="SKELETON" />
			<div class="h-48" :class="SKELETON" />
		</div>

		<BoNotice v-else type="danger">
			{{ registryError(error) }}
			<RouterLink
				to="/settings/marketplace"
				class="mt-2 flex w-fit items-center gap-1 rounded text-brand-500 dark:text-brand-400"
				:class="FOCUS"
			>
				<BoIcon name="arrow_back" size="sm" />
				{{ $t('marketplace') }}
			</RouterLink>
		</BoNotice>
	</PrivateView>
</template>
