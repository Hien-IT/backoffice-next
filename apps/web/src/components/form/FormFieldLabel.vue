<!-- Ported from directus/app/src/components/v-form/components/form-field-label.vue -->
<script setup lang="ts">
// Backoffice: Field label row recipe (component-specs, Q-1): the name is a <label for> (no menu button around it),
// the field menu is the `menu` slot (its chevron trigger); the collab indicator is removed (D-54). The hidden
// indicator shows when a hidden field is rendered (Directus: comparison mode only). The comparison checkbox selects a
// differing field to promote or restore (spec 014 FR-072, lifts D-55).
import { computed } from 'vue';
import BoCheckbox from '../BoCheckbox.vue';
import BoIcon from '../BoIcon.vue';
import BoTooltip from '../BoTooltip.vue';
import type { ComparisonContext, FormField } from './types.ts';

const props = withDefaults(
	defineProps<{
		field: FormField;
		batchMode?: boolean | undefined;
		batchActive?: boolean | undefined;
		disabled?: boolean | undefined;
		edited?: boolean | undefined;
		hasError?: boolean | undefined;
		badge?: string | null | undefined;
		loading?: boolean | undefined;
		rawEditorEnabled?: boolean | undefined;
		rawEditorActive?: boolean | undefined;
		inputId?: string | undefined;
		labelId?: string | undefined;
		comparison?: ComparisonContext | undefined;
		comparisonActive?: boolean | undefined;
	}>(),
	{
		batchMode: false,
		batchActive: false,
		disabled: false,
		edited: false,
		hasError: false,
		badge: null,
		loading: false,
		rawEditorEnabled: false,
		rawEditorActive: false,
		inputId: undefined,
		labelId: undefined,
		comparison: undefined,
		comparisonActive: false,
	},
);

const isPromotableField = computed(() => {
	if (!props.comparison) return false;
	return props.comparison.onToggleField !== null && props.comparison.fields.has(props.field.field);
});

defineEmits(['toggle-batch', 'toggle-raw']);

const ICON_BTN =
	'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="group mb-1.5 flex min-h-6 items-center gap-1.5 text-sm font-medium"
		:class="disabled ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-400'"
	>
		<BoCheckbox
			v-if="batchMode"
			:model-value="batchActive"
			:aria-labelledby="labelId"
			@update:model-value="$emit('toggle-batch', field)"
		/>

		<BoCheckbox
			v-if="isPromotableField"
			:model-value="comparisonActive"
			:aria-labelledby="labelId"
			data-comparison-checkbox
			@update:model-value="comparison!.onToggleField?.(field.field)"
		/>

		<BoTooltip v-if="edited && !batchMode && !hasError && !loading" :text="$t('edited')">
			<span class="inline-flex" data-edited>
				<span class="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-400" aria-hidden="true" />
				<span class="sr-only">{{ $t('edited') }}</span>
			</span>
		</BoTooltip>

		<label :id="labelId" :for="inputId" class="min-w-0 truncate" :title="field.name">{{ field.name }}</label>

		<template v-if="field.meta?.required === true">
			<span class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
			<span class="sr-only">{{ $t('required') }}</span>
		</template>

		<span
			v-if="field.meta?.hidden"
			class="inline-flex items-center justify-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80"
		>
			<BoIcon name="visibility_off" size="sm" />
			{{ $t('hidden') }}
		</span>

		<span
			v-if="badge"
			class="inline-flex items-center justify-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80"
		>
			{{ badge }}
		</span>

		<BoTooltip v-if="!disabled && rawEditorEnabled" :text="$t('toggle_raw_editor')">
			<button
				type="button"
				:aria-label="$t('toggle_raw_editor')"
				:aria-pressed="rawEditorActive ? 'true' : 'false'"
				:class="[
					ICON_BTN,
					rawEditorActive
						? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
						: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
				]"
				@click.stop="$emit('toggle-raw', !rawEditorActive)"
			>
				<BoIcon name="data_object" size="sm" />
			</button>
		</BoTooltip>

		<slot name="menu" />
	</div>
</template>
