<!-- Ported from directus/app/src/panels/relational-variable/multiple-relation.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-051, FR-052, FR-055, FR-056): v-list/v-list-item are a <ul> of bordered rows like the list
// interfaces (list-interface mixin), v-remove is BoRemove, v-notice is BoNotice, skeletons are pulse blocks; the text
// actions are buttons with the brand colour.
import { computed, toRefs } from 'vue';
import BoNotice from '../../components/BoNotice.vue';
import BoRemove from '../../components/BoRemove.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import useDisplayItems from './use-display-items.ts';

interface Props {
	value?: (string | number)[] | undefined;
	collection: string;
	template?: string | undefined;
	filter?: Record<string, any> | undefined;
	limit?: number;
}
const props = withDefaults(defineProps<Props>(), {
	value: undefined,
	template: undefined,
	filter: undefined,
	limit: 5,
});
const emit = defineEmits(['input', 'select']);

const { collection, template, value } = toRefs(props);

const { displayItems, displayTemplate, loading, primaryKey } = useDisplayItems(collection, template, value);
const totalItemCount = computed(() => displayItems.value?.length || 0);

function deleteItem(elem: Record<string, any>) {
	emit(
		'input',
		displayItems.value
			.filter((item) => item[primaryKey.value] !== elem[primaryKey.value])
			.map((item) => item[primaryKey.value]),
	);
}

const ACTION =
	'rounded px-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="one-to-many flex h-full flex-col justify-between gap-2">
		<div v-if="loading" aria-busy="true" class="flex flex-col gap-2">
			<span class="sr-only">{{ $t('loading') }}</span>
			<div
				v-for="n in limit"
				:key="n"
				aria-hidden="true"
				class="h-10 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
			/>
		</div>

		<BoNotice v-else-if="displayItems.length === 0">
			{{ $t('no_items') }}
		</BoNotice>

		<ul v-else class="flex flex-col gap-2">
			<li
				v-for="element in displayItems"
				:key="element[primaryKey]"
				class="flex items-center gap-2 rounded-lg border border-gray-300 bg-transparent ps-4 pe-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
				:class="displayItems.length > 4 ? 'min-h-10 py-0.5' : 'min-h-11 py-1'"
			>
				<span class="min-w-0 flex-1 truncate">
					<RenderTemplate :collection="collection" :item="element" :template="displayTemplate" />
				</span>

				<div class="item-actions flex shrink-0 items-center">
					<BoRemove deselect @action="deleteItem(element)" />
				</div>
			</li>
		</ul>

		<div class="actions flex items-center gap-2">
			<button v-if="totalItemCount < limit" type="button" :class="ACTION" @click="$emit('select')">
				{{ $t('add_existing') }}
			</button>
			<button v-if="totalItemCount > 0" type="button" :class="ACTION" @click="$emit('input', undefined)">
				{{ $t('clear_items') }}
			</button>
		</div>
	</div>
</template>
