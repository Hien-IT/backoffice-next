<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-simple/field-detail-simple.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-22): the interface cards of a group are a Reka RadioGroup (arrow keys move, Enter/Space choose;
// a click on the chosen card unchooses it, as Directus); the preview SVG loads on demand (src/interfaces/previews.ts),
// else the icon. The configuration panel takes the grid row after the chosen card (same window widths as Directus).
// Interface names come translated from the registry `$t:` keys.
import type { Collection } from '@directus/types';
import { useWindowSize } from '@vueuse/core';
import { orderBy } from 'lodash-es';
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui';
import { computed, reactive, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../../components/BoIcon.vue';
import { getInterfaces } from '../../../../../../interfaces/index.ts';
import { loadInterfacePreview } from '../../../../../../interfaces/previews.ts';
import { translateString } from '../../../../../../utils/translate-object-values.ts';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import FieldConfiguration from './FieldConfiguration.vue';

const props = withDefaults(
	defineProps<{
		collection: Collection;
		search?: string | null;
	}>(),
	{
		search: null,
	},
);

defineEmits<{
	(e: 'save'): void;
	(e: 'toggleAdvanced'): void;
}>();

const { collection, search } = toRefs(props);

const { t } = useI18n();

const fieldDetail = useFieldDetailStore();
watch(collection, () => fieldDetail.update({ collection: collection.value.collection }), { immediate: true });

const interfacesSorted = computed(() => {
	return orderBy(
		getInterfaces()
			.filter((inter) => !inter.system)
			.map((inter) => ({ ...inter, name: translateString(inter.name) })),
		['order'],
	);
});

const groups = computed(() => {
	const groupsWithInterfaces = [
		{ key: 'standard', name: t('interface_group_text_and_numbers'), interfaces: filterInterfacesByGroup('standard') },
		{ key: 'selection', name: t('interface_group_selection'), interfaces: filterInterfacesByGroup('selection') },
		{ key: 'relational', name: t('interface_group_relational'), interfaces: filterInterfacesByGroup('relational') },
		{
			key: 'presentation',
			name: t('interface_group_presentation'),
			interfaces: filterInterfacesByGroup('presentation'),
		},
		{ key: 'group', name: t('interface_group_groups'), interfaces: filterInterfacesByGroup('group') },
		{ key: 'other', name: t('interface_group_other'), interfaces: filterInterfacesByGroup('other') },
	];

	if (!search.value) return groupsWithInterfaces;

	return groupsWithInterfaces.filter((group) => group.interfaces.length > 0);

	function filterInterfacesByGroup(group: string) {
		const filteredInterfaces = interfacesSorted.value.filter((inter) => (inter.group ?? 'other') === group);
		if (!search.value) return filteredInterfaces;

		const searchValue = search.value!.toLowerCase();

		return filteredInterfaces.filter(
			(inter) => inter.id.toLowerCase().includes(searchValue) || inter.name.toLowerCase().includes(searchValue),
		);
	}
});

const chosenInterface = syncFieldDetailStoreProperty('field.meta.interface');

const { width: windowWidth } = useWindowSize();

const configRow = computed(() => {
	if (!chosenInterface.value) return null;

	let indexInGroup: number | null = null;

	groups.value.forEach((group) => {
		const index = group.interfaces.findIndex((inter) => inter.id === chosenInterface.value);
		if (index !== -1) indexInGroup = index;
	});

	if (indexInGroup === null) return null;

	let columns = 1;

	if (windowWidth.value > 400) {
		columns = 2;
	}

	if (windowWidth.value > 600) {
		columns = 3;
	}

	if (windowWidth.value > 840) {
		columns = 4;
	}

	return Math.ceil((indexInGroup + 1) / columns) + 1;
});

const previews = reactive<Record<string, string | undefined>>({});

watch(
	interfacesSorted,
	(interfaces) => {
		for (const inter of interfaces) {
			if (inter.id in previews) continue;
			previews[inter.id] = undefined;
			void loadInterfacePreview(inter.id).then((svg) => (previews[inter.id] = svg));
		}
	},
	{ immediate: true },
);

function toggleInterface(id: string) {
	if (chosenInterface.value === id) {
		chosenInterface.value = null;
	} else {
		chosenInterface.value = id;
	}
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="flex flex-col gap-12 p-6">
		<section v-for="group of groups" :key="group.key" :aria-labelledby="`interface-group-${group.key}`">
			<h2
				:id="`interface-group-${group.key}`"
				class="m-0 mb-5 border-b border-gray-200 pb-1 text-theme-xs font-bold tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:text-gray-400"
			>
				{{ group.name }}
			</h2>
			<RadioGroupRoot
				:model-value="chosenInterface ?? undefined"
				:aria-labelledby="`interface-group-${group.key}`"
				class="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 min-[600px]:grid-cols-3 min-[840px]:grid-cols-4"
				@update:model-value="chosenInterface = $event"
			>
				<RadioGroupItem
					v-for="inter of group.interfaces"
					:key="inter.id"
					:value="inter.id"
					class="flex min-h-24 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-start transition-opacity"
					:class="[
						FOCUS,
						chosenInterface === inter.id
							? 'border-brand-500 ring-2 ring-brand-500/20'
							: 'border-gray-200 dark:border-gray-800',
						{ 'opacity-50': chosenInterface && chosenInterface !== inter.id },
					]"
					@click="chosenInterface === inter.id && toggleInterface(inter.id)"
				>
					<span
						class="preview flex h-20 items-center justify-center overflow-hidden rounded-lg bg-gray-50 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400 [&_svg]:h-full [&_svg]:w-full"
						aria-hidden="true"
					>
						<!-- eslint-disable-next-line vue/no-v-html -- the preview SVG files are copied from the Directus source -->
						<span v-if="previews[inter.id]" class="contents" v-html="previews[inter.id]" />
						<BoIcon v-else :name="inter.icon" size="lg" class="text-brand-500" />
					</span>
					<span class="truncate text-theme-sm text-gray-800 dark:text-white/90">{{ inter.name }}</span>
				</RadioGroupItem>
				<FieldConfiguration
					v-if="chosenInterface && group.interfaces.some((inter) => inter.id === chosenInterface)"
					:row="configRow"
					@save="$emit('save')"
					@toggle-advanced="$emit('toggleAdvanced')"
				/>
			</RadioGroupRoot>
		</section>
	</div>
</template>

<style scoped>
/* The Directus preview SVGs draw with its theme variables: map them to the design-system tokens. */
.preview {
	--theme--primary: var(--color-brand-500);
	--theme--primary-subdued: var(--color-brand-100);
	--theme--background: var(--color-white);
}

:global(.dark) .preview {
	--theme--primary: var(--color-brand-400);
	--theme--background: var(--color-gray-900);
}

.preview :deep(svg) .glow {
	filter: drop-shadow(0 0 0.25rem var(--theme--primary-subdued));
}
</style>
