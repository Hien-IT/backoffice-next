<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-interface.vue -->
<script setup lang="ts">
// Backoffice: VFancySelect is BoFancySelect, VNotice BoNotice, VSkeletonLoader a pulsing block; registry names and
// descriptions are `$t:` keys, translated here (DR translates them when it registers the extensions).
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import ExtensionOptions from '../shared/ExtensionOptions.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useExtension } from '../../../../../../composables/use-extension.ts';
import BoFancySelect, { type FancySelectItem } from '../../../../../../components/BoFancySelect.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import { translateString } from '../../../../../../utils/translate-object-values.ts';

const fieldDetailStore = useFieldDetailStore();

const interfaceId = syncFieldDetailStoreProperty('field.meta.interface');

const { loading, field, interfacesForType } = storeToRefs(fieldDetailStore);
const type = computed(() => field.value.type);

const selectItems = computed(() => {
	const recommendedInterfacesPerType: { [type: string]: string[] } = {
		string: ['input', 'select-dropdown'],
		text: ['input-rich-text-html'],
		boolean: ['boolean'],
		integer: ['input'],
		bigInteger: ['input'],
		float: ['input'],
		decimal: ['input'],
		timestamp: ['datetime'],
		datetime: ['datetime'],
		date: ['datetime'],
		time: ['datetime'],
		json: ['select-multiple-checkbox', 'tags'],
		uuid: ['input'],
		csv: ['tags'],
	};

	const recommended = recommendedInterfacesPerType[type.value ?? 'alias'] || [];

	const interfaceItems: FancySelectItem[] = interfacesForType.value.map((inter) => {
		const item: FancySelectItem = {
			text: translateString(inter.name),
			description: inter.description ? translateString(inter.description) : undefined,
			value: inter.id,
			icon: inter.icon,
		};

		if (recommended.includes(item.value as string)) {
			item.iconRight = 'star';
		}

		return item;
	});

	const recommendedItems: FancySelectItem[] = [];

	const recommendedList = recommended.map((key) => interfaceItems.find((item) => item.value === key));

	if (recommendedList !== undefined) {
		recommendedItems.push(...recommendedList.filter((item): item is FancySelectItem => !!item));
	}

	if (interfaceItems.length >= 5 && recommended.length > 0) {
		recommendedItems.push({ divider: true });
	}

	const interfaceList = interfaceItems.filter((item) => recommended.includes(item.value as string) === false);

	if (interfaceList !== undefined) {
		recommendedItems.push(...interfaceList.filter((i) => i));
	}

	return recommendedItems;
});

const interfaceIsSelectable = computed(
	() => !!selectItems.value.find((selectItem) => selectItem.value === interfaceId.value),
);

const selectedInterface = useExtension('interface', interfaceId);

const customOptionsFields = computed(() => {
	if (typeof selectedInterface.value?.options === 'function') {
		return (selectedInterface.value.options as (context: unknown) => any)(fieldDetailStore);
	}

	return undefined;
});

const options = computed({
	get() {
		return fieldDetailStore.field.meta?.options ?? {};
	},
	set(newOptions: Record<string, any>) {
		fieldDetailStore.update({
			field: {
				meta: {
					options: newOptions,
				},
			},
		});
	},
});
</script>

<template>
	<div class="flex flex-col gap-7">
		<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
		<BoFancySelect v-else v-model="interfaceId" :items="selectItems" />

		<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
		<template v-else>
			<BoNotice v-if="interfaceId && (!selectedInterface || !interfaceIsSelectable)" type="danger">
				<span class="flex flex-wrap items-center gap-3">
					{{ $t('interface_not_found', { interface: interfaceId }) }}
					<button type="button" class="ms-auto underline" @click="interfaceId = null">
						{{ $t('reset_interface') }}
					</button>
				</span>
			</BoNotice>

			<ExtensionOptions
				v-if="interfaceId && selectedInterface && interfaceIsSelectable"
				v-model="options"
				type="interface"
				:options="customOptionsFields"
				:extension="interfaceId"
				show-advanced
			/>
		</template>
	</div>
</template>
