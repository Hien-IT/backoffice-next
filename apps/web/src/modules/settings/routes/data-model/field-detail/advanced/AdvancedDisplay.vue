<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-display.vue -->
<script setup lang="ts">
// Backoffice: VFancySelect is BoFancySelect, VNotice BoNotice, VSkeletonLoader a pulsing block; registry names and
// descriptions are `$t:` keys, translated here (DR translates them when it registers the extensions).
import { clone } from 'lodash-es';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import ExtensionOptions from '../shared/ExtensionOptions.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useExtension } from '../../../../../../composables/use-extension.ts';
import BoFancySelect, { type FancySelectItem } from '../../../../../../components/BoFancySelect.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import { translateString } from '../../../../../../utils/translate-object-values.ts';

const fieldDetailStore = useFieldDetailStore();

const { loading, field, displaysForType } = storeToRefs(fieldDetailStore);

const interfaceId = computed(() => field.value.meta?.interface ?? null);
const display = syncFieldDetailStoreProperty('field.meta.display');

const selectedInterface = useExtension('interface', interfaceId);
const selectedDisplay = useExtension('display', display);

const selectItems = computed(() => {
	let recommended = clone(selectedInterface.value?.recommendedDisplays) || [];

	recommended.push('raw', 'formatted-value');
	recommended = [...new Set(recommended)];

	const displayItems: FancySelectItem[] = displaysForType.value.map((display) => {
		const item: FancySelectItem = {
			text: translateString(display.name),
			description: display.description ? translateString(display.description) : undefined,
			value: display.id,
			icon: display.icon,
		};

		if (recommended.includes(item.value as string)) {
			item.iconRight = 'star';
		}

		return item;
	});

	const recommendedItems: FancySelectItem[] = [];

	const recommendedList = recommended.map((key: any) => displayItems.find((item) => item.value === key));

	if (recommendedList !== undefined) {
		recommendedItems.push(...recommendedList.filter((item): item is FancySelectItem => !!item));
	}

	if (displayItems.length >= 5 && recommended.length > 0) {
		recommendedItems.push({ divider: true });
	}

	const displayList = displayItems.filter((item) => recommended.includes(item.value as string) === false);

	if (displayList !== undefined) {
		recommendedItems.push(...displayList.filter((i) => i));
	}

	return recommendedItems;
});

const customOptionsFields = computed(() => {
	if (typeof selectedDisplay.value?.options === 'function') {
		return (selectedDisplay.value.options as (context: unknown) => any)(fieldDetailStore);
	}

	return undefined;
});

const options = computed({
	get() {
		return fieldDetailStore.field.meta?.display_options ?? {};
	},
	set(newOptions: Record<string, any>) {
		fieldDetailStore.update({
			field: {
				meta: {
					display_options: newOptions,
				},
			},
		});
	},
});
</script>

<template>
	<div class="flex flex-col gap-7">
		<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
		<BoFancySelect v-else v-model="display" :items="selectItems" />

		<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
		<template v-else>
			<BoNotice v-if="display && !selectedDisplay" type="danger">
				<span class="flex flex-wrap items-center gap-3">
					{{ $t('display_not_found', { display: display }) }}
					<button type="button" class="ms-auto underline" @click="display = null">{{ $t('reset_display') }}</button>
				</span>
			</BoNotice>

			<ExtensionOptions
				v-if="display && selectedDisplay"
				v-model="options"
				type="display"
				:options="customOptionsFields"
				:extension="display"
			/>
		</template>
	</div>
</template>
