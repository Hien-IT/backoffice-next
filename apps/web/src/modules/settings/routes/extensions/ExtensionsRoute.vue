<!-- Ported from directus/app/src/modules/settings/routes/extensions/extensions.vue -->
<script setup lang="ts">
// Backoffice (spec 020 US5, recipe Q-41): PrivateView with the settings sub-menu, groups in API order, skeleton rows
// until the first answer, BoInfo when empty.
import type { ApiOutput } from '@directus/types';
import { groupBy } from 'lodash-es';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import BoInfo from '../../../../components/BoInfo.vue';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useExtensionsStore } from '../../../../stores/extensions.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import ExtensionGroupDivider from './components/ExtensionGroupDivider.vue';
import ExtensionItem from './components/ExtensionItem.vue';
import type { ExtensionType } from './types.ts';

type ExtensionsMap = Record<ExtensionType, ApiOutput[]>;

const extensionsStore = useExtensionsStore();
const { extensions, loading } = storeToRefs(extensionsStore);

const bundled = computed(() => extensionsStore.extensions.filter(({ bundle }) => bundle !== null));

const regular = computed(() => extensionsStore.extensions.filter(({ bundle }) => bundle === null));

const extensionsByType = computed(() => {
	const groups = groupBy(regular.value, 'schema.type');

	if ('undefined' in groups) {
		groups['missing'] = groups['undefined'];
		delete groups['undefined'];
	}

	return groups as ExtensionsMap;
});
</script>

<template>
	<PrivateView :title="$t('extensions')" icon="category" :breadcrumb="[{ name: $t('settings'), to: '/settings' }]">
		<template #navigation>
			<SettingsNavigation />
		</template>

		<div class="max-w-5xl">
			<div v-if="extensions.length === 0 && loading" class="space-y-2" aria-busy="true">
				<div
					v-for="n in 6"
					:key="n"
					class="h-14 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
				/>
			</div>

			<template v-else-if="extensions.length > 0">
				<section v-for="(list, type) in extensionsByType" :key="`${type}-list`">
					<ExtensionGroupDivider :type="type" />

					<ul class="m-0 space-y-2 p-0">
						<ExtensionItem
							v-for="extension in list"
							:key="extension.id"
							:extension
							:children="
								extension.schema?.type === 'bundle' ? bundled.filter(({ bundle }) => bundle === extension.id) : []
							"
						/>
					</ul>
				</section>
			</template>

			<BoInfo v-else icon="error" :title="$t('no_extensions')">
				{{ $t('no_extensions_copy') }}
			</BoInfo>
		</div>
	</PrivateView>
</template>
