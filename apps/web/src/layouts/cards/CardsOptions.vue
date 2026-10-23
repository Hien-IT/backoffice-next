<!-- Ported from directus/app/src/layouts/cards/options.vue -->
<script setup lang="ts">
// Backoffice: BoSelect with its label instead of `.type-label` + v-select (`show-deselect` = a "Deselect" item while a
// source is set); v-collection-field-template is a BoInput with a field picker button (FieldList in a popover, as the
// tabular "+" button) that appends `{{ field }}` to the template (DR inserts at the caret of its chip editor);
// InterfaceSelectIcon is its BoIconPicker; v-detail is BoDetail; `useSync` = emit of the update.
import type { Field } from '@directus/types';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { useId } from 'vue';
import BoDetail from '../../components/BoDetail.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoIconPicker from '../../components/BoIconPicker.vue';
import BoInput from '../../components/BoInput.vue';
import BoSelect from '../../components/BoSelect.vue';
import FieldList from '../../components/FieldList.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
	collection: string;
	icon: string;
	fileFields: Field[];
	imageFit: string;
	imageSource?: string | null | undefined;
	title?: string | null | undefined;
	subtitle?: string | null | undefined;
}>();

const emit = defineEmits<{
	'update:icon': [icon: string | null];
	'update:imageSource': [imageSource: string | null];
	'update:title': [title: string | null];
	'update:subtitle': [subtitle: string | null];
	'update:imageFit': [imageFit: string];
}>();

const DESELECT = '$deselect';
const TEMPLATE_KEYS = ['title', 'subtitle'] as const;
const iconLabelId = useId();

function setImageSource(value: string) {
	emit('update:imageSource', value === DESELECT ? null : value);
}

function setTemplate(key: 'title' | 'subtitle', value: string) {
	if (key === 'title') emit('update:title', value || null);
	else emit('update:subtitle', value || null);
}

function addField(key: 'title' | 'subtitle', field: string) {
	setTemplate(key, `${props[key] ?? ''}{{ ${field} }}`);
}

const ICON_BTN =
	'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<BoSelect
		:label="$t('layouts.cards.image_source')"
		:model-value="imageSource ?? null"
		:items="[
			...(imageSource ? [{ text: $t('deselect'), value: DESELECT, icon: 'close' }] : []),
			...fileFields.map((field) => ({ text: field.name, value: field.field })),
		]"
		@update:model-value="setImageSource"
	/>

	<div v-for="key in TEMPLATE_KEYS" :key="key" class="flex items-end gap-2">
		<div class="min-w-0 flex-1">
			<BoInput
				:label="$t(key === 'title' ? 'layouts.cards.title' : 'layouts.cards.subtitle')"
				:model-value="props[key] ?? ''"
				@update:model-value="setTemplate(key, $event)"
			/>
		</div>
		<PopoverRoot>
			<PopoverTrigger :class="ICON_BTN" :aria-label="$t('add_field')" :title="$t('add_field')">
				<BoIcon name="add" size="sm" />
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent :side-offset="4" align="end" :collision-padding="8" :class="POPOVER">
					<FieldList :collection="collection" :allow-select-all="false" @add="addField(key, $event[0]!)" />
				</PopoverContent>
			</PopoverPortal>
		</PopoverRoot>
	</div>

	<BoDetail :title="$t('advanced')">
		<div class="flex flex-col gap-4.5">
			<BoSelect
				:label="$t('layouts.cards.image_fit')"
				:model-value="imageFit"
				:disabled="imageSource === null"
				:items="[
					{ text: $t('layouts.cards.crop'), value: 'crop' },
					{ text: $t('layouts.cards.contain'), value: 'contain' },
				]"
				@update:model-value="emit('update:imageFit', $event)"
			/>

			<div>
				<span :id="iconLabelId" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
					{{ $t('fallback_icon') }}
				</span>
				<BoIconPicker
					:model-value="icon"
					:aria-labelledby="iconLabelId"
					@update:model-value="emit('update:icon', $event)"
				/>
			</div>
		</div>
	</BoDetail>
</template>
