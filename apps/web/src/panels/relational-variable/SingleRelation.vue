<!-- Ported from directus/app/src/panels/relational-variable/single-relation.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-051, FR-052, FR-055, FR-056): the clickable v-input is the field-styled row of
// select-dropdown-m2o (a native button stretched over the row, BoRemove as a sibling button) inside the tile region
// named by the panel; the skeleton is a pulse block.
import { computed, toRefs } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoRemove from '../../components/BoRemove.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import useDisplayItems from './use-display-items.ts';

interface Props {
	value?: (string | number)[] | undefined;
	collection: string;
	template?: string | undefined;
	filter?: Record<string, any> | undefined;
}
const props = defineProps<Props>();
defineEmits(['input', 'select']);

const { collection, template, value } = toRefs(props);

const { displayItems, displayTemplate, loading } = useDisplayItems(collection, template, value);
const displayItem = computed(() => (displayItems.value.length > 0 ? displayItems.value[0] : null));
</script>

<template>
	<div class="many-to-one">
		<div
			v-if="loading"
			aria-busy="true"
			class="h-11 w-full animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
		>
			<span class="sr-only">{{ $t('loading') }}</span>
		</div>

		<div
			v-else
			class="relative flex min-h-11 w-full items-center gap-1 rounded-lg border border-gray-300 bg-transparent py-1 ps-4 pe-2 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
		>
			<button
				type="button"
				class="main min-w-0 flex-1 truncate text-start outline-hidden after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-500 dark:focus-visible:after:outline-brand-400"
				@click="$emit('select')"
			>
				<span v-if="displayItem" class="preview block truncate">
					<RenderTemplate :collection="collection" :item="displayItem" :template="displayTemplate" />
				</span>
				<span v-else class="text-gray-500 dark:text-gray-400">{{ $t('select_an_item') }}</span>
			</button>

			<div class="item-actions flex shrink-0 items-center gap-0.5">
				<BoRemove v-if="displayItem" class="relative z-1" deselect @action="$emit('input', undefined)" />
				<BoIcon
					v-else
					class="pointer-events-none px-1.5 text-gray-500 dark:text-gray-400"
					name="expand_more"
					size="sm"
				/>
			</div>
		</div>
	</div>
</template>
