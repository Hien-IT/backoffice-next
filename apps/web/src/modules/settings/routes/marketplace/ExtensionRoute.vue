<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/extension.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-banner.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-readme.vue -->
<script setup lang="ts">
// Backoffice (spec 020 US6, recipe Q-43): the banner and readme components are inlined (a card each); two columns
// from `xl`. Loading shows a skeleton of the banner and the column; an error (not found, registry down) a danger
// BoNotice with a link back to the registry. The readme is md() with `target: '_blank'` (sanitized, DOMPurify).
import { computed, ref, watchEffect } from 'vue';
import { RouterLink } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoChip from '../../../../components/BoChip.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import PrivateView from '../../../../layout/PrivateView.vue';
import { localizedFormatDistanceStrict } from '../../../../utils/localized-format-distance-strict.ts';
import { md } from '../../../../utils/markdown.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import { extensionTypeIconMap } from '../extensions/constants.ts';
import ExtensionMetadata from './components/ExtensionMetadata.vue';
import type { RegistryExtension } from './types.ts';
import { formatName } from './utils/format-name.ts';
import { registryError } from './utils/registry-error.ts';

const props = defineProps<{
	extensionId: string;
}>();

const loading = ref(false);
const error = ref<unknown>(null);
const extension = ref<RegistryExtension>();

watchEffect(async () => {
	if (!props.extensionId) return;

	loading.value = true;

	try {
		extension.value = await sdk.request(
			requestEndpoint<RegistryExtension>(`/extensions/registry/extension/${props.extensionId}`, { method: 'GET' }),
		);
	} catch (err) {
		error.value = err;
	} finally {
		loading.value = false;
	}
});

const newestVersion = computed(() => extension.value?.versions.at(0));
const readme = computed(() => (extension.value?.readme ? md(extension.value.readme, { target: '_blank' }) : null));

const CARD = 'rounded-2xl border border-gray-200 p-6 dark:border-gray-800';
const SKELETON = 'animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none dark:bg-gray-800';
// Readme typography (recipe Q-43: the markdown display styles, links in the brand color).
const PROSE =
	'text-theme-sm text-gray-700 dark:text-gray-300 wrap-break-word [&_a]:text-brand-500 [&_a]:underline dark:[&_a]:text-brand-400 [&_h1]:mb-3 [&_h1]:text-title-sm [&_h1]:font-semibold [&_h1]:text-gray-800 dark:[&_h1]:text-white/90 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-800 dark:[&_h2]:text-white/90 [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-gray-800 dark:[&_h3]:text-white/90 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_img]:inline [&_img]:max-w-full [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:font-mono dark:[&_code]:bg-gray-800 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-4 dark:[&_pre]:bg-gray-800 [&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-gray-800 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 dark:[&_th]:border-gray-800 [&_blockquote]:border-s-4 [&_blockquote]:border-gray-200 [&_blockquote]:ps-4 dark:[&_blockquote]:border-gray-800';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PrivateView :title="$t('marketplace')" back="/settings/marketplace">
		<template #navigation>
			<SettingsNavigation />
		</template>

		<div v-if="extension && newestVersion" class="grid gap-6 xl:grid-cols-[1fr_20rem]">
			<div class="min-w-0 space-y-6">
				<section :class="CARD" class="flex items-start gap-4">
					<span
						class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						<BoIcon :name="extensionTypeIconMap[extension.type]" />
					</span>
					<div class="min-w-0 space-y-1">
						<BoChip outlined size="sm">{{ $t(`extension_${extension.type}`) }}</BoChip>
						<h2 class="m-0 text-title-sm font-semibold text-gray-800 dark:text-white/90">
							{{ formatName(extension) }}
						</h2>
						<p v-if="extension.description" class="m-0 text-theme-sm text-gray-500 dark:text-gray-400">
							{{ extension.description }}
						</p>
						<p class="m-0 text-theme-xs text-gray-500 dark:text-gray-400">
							v{{ newestVersion.version }} •
							{{
								$t('published_relative', {
									relativeTime: localizedFormatDistanceStrict(new Date(newestVersion.publish_date), new Date(), {
										addSuffix: true,
									}),
								})
							}}
						</p>
					</div>
				</section>

				<BoNotice v-if="!readme">{{ $t('extension_readme_missing') }}</BoNotice>
				<!-- sanitized by md() (DOMPurify) -->
				<!-- eslint-disable vue/no-v-html -->
				<section v-else :class="[CARD, PROSE]" data-readme v-html="readme" />
				<!-- eslint-enable vue/no-v-html -->
			</div>

			<ExtensionMetadata :extension="extension" class="self-start" />
		</div>

		<div v-else-if="loading" class="grid gap-6 xl:grid-cols-[1fr_20rem]" aria-busy="true">
			<div class="space-y-6">
				<div class="h-32" :class="SKELETON" />
				<div class="h-64" :class="SKELETON" />
			</div>
			<div class="h-96" :class="SKELETON" />
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
