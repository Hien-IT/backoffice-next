<!-- Ported from directus/app/src/modules/settings/routes/data-model/fields/components/FieldSelect.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-21): the content of one row of the field grid. The row box, drag handle and menu come from the
// BoSortableList row; a group field shows its header and its own nested BoSortableList of the `fields` group. The
// duplicate and delete dialogs and the menu actions are in FieldsManagement.vue (one dialog for the page instead of
// one per row). A locked (system) field is the disabled variant: lock icon, no handle, no menu. Tooltips are `title`.
import type { Field } from '@directus/types';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoSortableList from '../../../../../components/BoSortableList.vue';
import { getInterface } from '../../../../../interfaces/index.ts';
import { getLocalTypeForField } from '../../../../../utils/get-local-type.ts';
import { getRelatedCollection } from '../../../../../utils/get-related-collection.ts';
import { translateString } from '../../../../../utils/translate-object-values.ts';
import { FIELD_GRID, GRID, widthClass } from './field-grid.ts';

const props = defineProps<{
	field: Field;
	disabled?: boolean;
}>();

const { t } = useI18n();
const grid = inject(FIELD_GRID)!;

const interfaceName = computed(() => {
	const name = getInterface(props.field.meta?.interface)?.name;
	return name ? translateString(name) : null;
});

const hidden = computed(() => props.field.meta?.hidden === true);

const localType = computed(() => getLocalTypeForField(props.field.collection, props.field.field));

const nestedFields = computed(() => grid.childrenOf(props.field.field));

const relatedCollectionInfo = computed(() => getRelatedCollection(props.field.collection, props.field.field));

const showRelatedCollectionLink = computed(
	() =>
		relatedCollectionInfo.value !== null &&
		props.field.collection !== relatedCollectionInfo.value?.relatedCollection &&
		['translations', 'm2o', 'm2m', 'o2m', 'files'].includes(localType.value as string),
);

const tFieldType = (type: string) => t(type === 'geometry' ? 'geometry.All' : type);

const tooltip = computed(
	() =>
		`${props.field.name} (${tFieldType(props.field.type)})${interfaceName.value ? ` - ${interfaceName.value}` : ''}`,
);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON = 'shrink-0 text-gray-500 dark:text-gray-400';
// Template: rows are not text-selectable and long names cut with an ellipsis: FieldSelect.vue:381-382, 515-527
</script>

<template>
	<div
		v-if="disabled"
		class="flex min-h-7 items-center gap-2 text-gray-500 select-none dark:text-gray-400"
		:title="tooltip"
	>
		<BoIcon
			name="lock"
			size="sm"
			:class="ICON"
			:label="$t('system_fields_locked')"
			:title="$t('system_fields_locked')"
		/>
		<span class="truncate font-mono text-theme-sm">{{ field.field }}</span>
		<span v-if="interfaceName" class="truncate text-theme-xs">{{ interfaceName }}</span>
	</div>

	<div v-else-if="localType === 'group'" class="flex flex-col gap-2 select-none">
		<div class="flex min-h-7 items-center gap-2">
			<span
				class="truncate font-mono text-theme-sm"
				:class="hidden ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white/90'"
			>
				{{ field.field }}
			</span>
			<template v-if="field.meta?.required === true">
				<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" aria-hidden="true" />
				<span class="sr-only">{{ $t('required') }}</span>
			</template>
			<BoIcon
				v-if="hidden"
				name="visibility_off"
				size="sm"
				:class="ICON"
				:label="$t('hidden_field')"
				:title="$t('hidden_field')"
			/>
		</div>
		<div class="rounded-xl border border-dashed border-gray-300 p-2 dark:border-gray-700">
			<BoSortableList
				:model-value="nestedFields"
				item-key="field"
				group="fields"
				tree
				nested
				:list-class="`${GRID} min-h-11`"
				:row-class="widthClass"
				:item-label="(item: Field) => item.field"
				:row-actions="(item: Field) => grid.menuFor(item)"
				:can-indent="(_: Field, index: number) => grid.canIndent(nestedFields, index)"
				@update:model-value="grid.sortList($event, field.field)"
				@change="grid.onChange(field.field, $event)"
				@indent="grid.indent(nestedFields, $event)"
				@outdent="grid.outdent(nestedFields, $event, field.field)"
			>
				<template #item="{ element }">
					<FieldSelect :field="element" />
				</template>
			</BoSortableList>
		</div>
	</div>

	<!-- A hidden field is dimmed with the FR-106 muted colors, not opacity (contrast). -->
	<div v-else class="flex min-h-7 items-center gap-2 select-none" :class="{ 'hidden-field': hidden }">
		<button
			type="button"
			class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-start"
			:class="FOCUS"
			:title="tooltip"
			@click="grid.open(field)"
		>
			<span class="truncate font-mono text-theme-sm text-gray-800 dark:text-white/90">{{ field.field }}</span>
			<template v-if="field.meta?.required === true">
				<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" aria-hidden="true" />
				<span class="sr-only">{{ $t('required') }}</span>
			</template>
			<span class="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400">
				{{ field.meta ? interfaceName : $t('db_only_click_to_configure') }}
			</span>
		</button>

		<BoIcon
			v-if="field.schema?.is_primary_key"
			name="vpn_key"
			size="sm"
			:class="ICON"
			:label="$t('primary_key')"
			:title="$t('primary_key')"
		/>
		<BoIcon
			v-if="!field.meta"
			name="report_problem"
			size="sm"
			class="shrink-0 text-warning-500"
			:label="$t('db_only_click_to_configure')"
			:title="$t('db_only_click_to_configure')"
		/>
		<BoIcon
			v-if="hidden"
			name="visibility_off"
			size="sm"
			:class="ICON"
			:label="$t('hidden_field')"
			:title="$t('hidden_field')"
		/>
		<RouterLink
			v-if="showRelatedCollectionLink"
			:to="{ name: 'settings-fields', params: { collection: relatedCollectionInfo!.relatedCollection } }"
			class="inline-flex rounded"
			:class="FOCUS"
			:aria-label="`${$t('open')} ${relatedCollectionInfo!.relatedCollection}`"
			:title="relatedCollectionInfo!.relatedCollection"
		>
			<BoIcon name="open_in_new" size="sm" :class="ICON" />
		</RouterLink>
	</div>
</template>
