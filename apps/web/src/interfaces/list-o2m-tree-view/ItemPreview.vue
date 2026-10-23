<!-- Ported from directus/app/src/interfaces/list-o2m-tree-view/item-preview.vue -->
<script setup lang="ts">
// Backoffice: the row content of a BoSortableList row. The edit icon and v-remove move to the row menu of
// NestedDraggable (SortableList row menu recipe), which also holds the item drawer, so this component emits `edit`
// (click on a non-editable preview, as DR opens the drawer there). The chevron is a button with
// `aria-expanded`; a removed item is struck through besides the danger color (state not by color alone).
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';

const props = withDefaults(
	defineProps<{
		collection: string;
		template: string;
		item: Record<string, any>;
		relationInfo: RelationO2M;
		disabled?: boolean;
		nonEditable?: boolean;
		open?: boolean;
		deleted: boolean;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		open: false,
	},
);

const emit = defineEmits(['update:open', 'edit']);

const { t } = useI18n();

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="preview flex min-h-6 min-w-0 items-center gap-1 text-sm"
		:class="[
			{ open, deleted, disabled },
			deleted && !disabled ? 'text-error-600 line-through dark:text-error-400' : 'text-gray-800 dark:text-white/90',
		]"
	>
		<button
			v-if="relationInfo.relatedPrimaryKeyField.field in item"
			type="button"
			class="chevron inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300"
			:class="FOCUS"
			:aria-expanded="props.open"
			:aria-label="t(props.open ? 'collapse' : 'expand')"
			:disabled="disabled && !nonEditable"
			@click.stop="emit('update:open', !props.open)"
		>
			<BoIcon :name="props.open ? 'expand_more' : 'chevron_right'" size="sm" />
		</button>

		<button
			v-if="nonEditable"
			type="button"
			class="view template min-w-0 flex-1 truncate rounded text-start"
			:class="FOCUS"
			@click="emit('edit')"
		>
			<RenderTemplate :collection="collection" :template="template" :item="item" />
		</button>

		<span v-else class="template min-w-0 flex-1 truncate">
			<RenderTemplate :collection="collection" :template="template" :item="item" />
		</span>
	</div>
</template>
