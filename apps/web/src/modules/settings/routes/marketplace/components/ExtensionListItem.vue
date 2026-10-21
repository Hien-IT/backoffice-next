<!-- Ported from directus/app/src/modules/settings/routes/marketplace/components/extension-list-item.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-42): a list row holding a RouterLink card (icon tile, name with the type and installed chips,
// author with the verified icon, two-line description, meta column from `sm`); the parent renders the `ul`.
import { abbreviateNumber } from '@directus/utils';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoChip from '../../../../../components/BoChip.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import { useExtensionsStore } from '../../../../../stores/extensions.ts';
import { localizedFormatDistanceStrict } from '../../../../../utils/localized-format-distance-strict.ts';
import { extensionTypeIconMap } from '../../extensions/constants.ts';
import type { RegistryListItem } from '../types.ts';
import { formatName } from '../utils/format-name.ts';

const { t } = useI18n();

const extensionsStore = useExtensionsStore();

const props = defineProps<{
	extension: RegistryListItem;
	showType?: boolean;
}>();

const icon = computed(() => extensionTypeIconMap[props.extension.type]);
const chip = computed(() => t(`extension_${props.extension.type}`));

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<li class="list-none">
		<RouterLink
			:to="{ name: 'marketplace-extension', params: { extensionId: extension.id } }"
			class="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 no-underline hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-800"
			:class="FOCUS"
		>
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
			>
				<BoIcon :name="icon" />
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="flex flex-wrap items-center gap-2 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
					{{ formatName(extension) }}
					<BoChip v-if="showType" outlined size="sm">{{ chip }}</BoChip>
					<BoChip v-if="extensionsStore.extensionIds.includes(extension.id)" outlined size="sm">
						{{ $t('installed') }}
					</BoChip>
				</span>
				<span class="flex items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
					{{ extension.publisher.github_name ?? extension.publisher.username }}
					<BoIcon
						v-if="extension.publisher.verified"
						name="verified"
						size="sm"
						:label="$t('verified')"
						class="text-brand-500 dark:text-brand-400"
					/>
				</span>
				<span class="line-clamp-2 text-theme-sm text-gray-500 dark:text-gray-400">
					{{ extension.description || $t('no_description') }}
				</span>
			</span>
			<span class="hidden shrink-0 flex-col items-end gap-1 text-theme-xs text-gray-500 sm:flex dark:text-gray-400">
				<span class="flex items-center gap-1">
					{{ localizedFormatDistanceStrict(new Date(extension.last_updated), new Date()) }}
					<BoIcon name="event" size="sm" />
				</span>
				<span class="flex items-center gap-1">
					{{ abbreviateNumber(extension.total_downloads) }}
					<BoIcon name="download" size="sm" />
				</span>
				<span class="flex items-center gap-1" :class="{ uppercase: !!extension.license }">
					{{ extension.license ?? $t('unknown') }}
					<BoIcon name="policy" size="sm" />
				</span>
			</span>
		</RouterLink>
	</li>
</template>
