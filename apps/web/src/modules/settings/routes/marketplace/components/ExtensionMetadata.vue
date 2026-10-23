<!-- Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-author.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-compatibility.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-date.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-downloads.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-license.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-size.vue; Ported from directus/app/src/modules/settings/routes/marketplace/routes/extension/components/extension-metadata-version.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-43): one card `space-y-4 p-5` holding the install button, the author buttons (32 px avatar,
// verified icon) and, below a divider, the metadata rows. The one-row DR components (author, compatibility,
// date, downloads, license, size, version) are inlined here as MetadataItem rows.
import { satisfies } from 'semver';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import { useServerStore } from '../../../../../stores/server.ts';
import { formatFilesize } from '../../../../../utils/format-filesize.ts';
import { localizedFormatDistanceStrict } from '../../../../../utils/localized-format-distance-strict.ts';
import type { RegistryExtension } from '../types.ts';
import DownloadsSparkline from './DownloadsSparkline.vue';
import ExtensionInstall from './ExtensionInstall.vue';
import MetadataItem from './MetadataItem.vue';

const props = defineProps<{
	extension: RegistryExtension;
}>();

const { t, d, n } = useI18n();
const serverStore = useServerStore();

const latestVersion = computed(() => props.extension.versions.at(0)!);

const maintainers = computed(() => {
	const publisherId = latestVersion.value.publisher.id;

	return (
		latestVersion.value.maintainers
			?.filter(({ accounts_id: maintainer }) => maintainer.id !== publisherId)
			.map(({ accounts_id: maintainer }) => maintainer) ?? []
	);
});

const authors = computed(() => [latestVersion.value.publisher, ...maintainers.value]);

const currentVersion = computed(() => serverStore.info.version ?? '');
const isCompatible = computed(() => satisfies(currentVersion.value, latestVersion.value.host_version));

const compatibilityTooltip = computed(() =>
	t(isCompatible.value ? 'compatible_with_your_project_copy' : 'compatibility_not_guaranteed_copy', {
		currentVersion: currentVersion.value,
		hostVersion: latestVersion.value.host_version,
	}),
);
</script>

<template>
	<div class="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
		<div class="space-y-2">
			<ExtensionInstall :extension-id="extension.id" :version-id="latestVersion.id" />

			<BoButton
				v-for="author in authors"
				:key="author.id"
				variant="secondary"
				full-width
				align="start"
				:to="{ name: 'marketplace-account', params: { accountId: author.id } }"
			>
				<img
					v-if="author.github_avatar_url"
					:src="author.github_avatar_url"
					:alt="author.github_name ?? author.username"
					class="size-8 shrink-0 rounded-full"
				/>
				<BoIcon v-else name="face" />
				<span class="truncate">{{ author.github_name ?? author.username }}</span>
				<BoIcon
					v-if="author.verified"
					name="verified"
					size="sm"
					:label="$t('verified')"
					class="text-brand-500 dark:text-brand-400"
				/>
			</BoButton>
		</div>

		<div class="h-px bg-gray-200 dark:bg-gray-800" role="separator" />

		<div>
			<DownloadsSparkline v-if="extension.downloads" :downloads="extension.downloads" />
			<MetadataItem icon="save_alt">{{ $t('n_downloads', { n: n(extension.total_downloads) }) }}</MetadataItem>
			<MetadataItem icon="sell">v{{ latestVersion.version }}</MetadataItem>
			<MetadataItem
				:icon="isCompatible ? 'check' : 'warning'"
				:color="isCompatible ? 'subdued' : 'warning'"
				:tooltip="compatibilityTooltip"
			>
				{{ isCompatible ? $t('compatible_with_your_project') : $t('compatibility_not_guaranteed') }}
			</MetadataItem>
			<MetadataItem icon="event" :tooltip="d(new Date(latestVersion.publish_date), 'long')">
				{{
					$t('last_updated_relative', {
						relativeTime: localizedFormatDistanceStrict(new Date(latestVersion.publish_date), new Date(), {
							addSuffix: true,
						}),
					})
				}}
			</MetadataItem>
			<MetadataItem icon="policy" :class="{ uppercase: !!extension.license }">
				{{ extension.license ?? $t('unknown') }}
			</MetadataItem>
			<MetadataItem icon="folder_open">
				{{ formatFilesize(latestVersion.unpacked_size) }} ({{ $t('n_files', latestVersion.file_count) }})
			</MetadataItem>
			<MetadataItem v-if="latestVersion.url_homepage" icon="link" :href="latestVersion.url_homepage">
				{{ $t('homepage') }}
			</MetadataItem>
			<MetadataItem v-if="latestVersion.url_repository" icon="commit" :href="latestVersion.url_repository">
				{{ $t('repository') }}
			</MetadataItem>
			<MetadataItem v-if="latestVersion.url_bugs" icon="bug_report" :href="latestVersion.url_bugs">
				{{ $t('report_an_issue') }}
			</MetadataItem>
		</div>
	</div>
</template>
