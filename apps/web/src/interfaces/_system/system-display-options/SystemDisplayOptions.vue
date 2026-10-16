<!-- Ported from directus/app/src/interfaces/_system/system-display-options/system-display-options.vue -->
<script setup lang="ts">
// Backoffice: VForm is BoForm, VNotice is BoNotice; an options component (list, map) is the config's `options` itself
// instead of a registered `display-options-<id>` component. The inset frame is the Input border recipe.
import type { ExtensionOptionsContext } from '@directus/types';
import { isVueComponent } from '@directus/utils';
import { type Component, computed, inject, ref } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoForm from '../../../components/form/BoForm.vue';
import { useExtension } from '../../../composables/use-extension.ts';

const props = defineProps<{
	value: Record<string, unknown> | null;
	displayField?: string;
	display?: string;
	collection?: string;
	disabled?: boolean;
	context?: () => ExtensionOptionsContext;
}>();

const emit = defineEmits<{
	(e: 'input', value: Record<string, unknown> | null): void;
}>();

const options = computed({
	get() {
		return props.value ?? {};
	},
	set(newVal: any) {
		emit('input', newVal);
	},
});

const values = inject('values', ref<Record<string, any>>({}));

const selectedDisplayId = computed(() => props.display ?? values.value[props.displayField!] ?? null);
const selectedDisplay = useExtension('display', selectedDisplayId);

const usesCustomComponent = computed(() => {
	if (!selectedDisplay.value) return false;

	return isVueComponent(selectedDisplay.value.options);
});

const optionsFields = computed(() => {
	if (!selectedDisplay.value?.options || usesCustomComponent.value) return [];

	let optionsObjectOrArray: any;

	if (typeof selectedDisplay.value.options === 'function') {
		optionsObjectOrArray = (selectedDisplay.value.options as (context: ExtensionOptionsContext) => unknown)(
			props.context?.() ??
				({
					field: {
						type: 'unknown',
					},
					editing: '+',
					collection: props.collection,
					relations: {
						o2m: undefined,
						m2o: undefined,
						m2a: undefined,
					},
					collections: {
						related: undefined,
						junction: undefined,
					},
					fields: {
						corresponding: undefined,
						junctionCurrent: undefined,
						junctionRelated: undefined,
						sort: undefined,
					},
					items: {},
					localType: 'standard',
					autoGenerateJunctionRelation: false,
					saving: false,
				} as unknown as ExtensionOptionsContext),
		);
	} else {
		optionsObjectOrArray = selectedDisplay.value.options;
	}

	if (Array.isArray(optionsObjectOrArray)) return optionsObjectOrArray;

	return [...optionsObjectOrArray.standard, ...optionsObjectOrArray.advanced];
});
</script>

<template>
	<BoNotice v-if="!selectedDisplay">
		{{ $t('select_display') }}
	</BoNotice>

	<BoNotice v-else-if="usesCustomComponent === false && optionsFields.length === 0">
		{{ $t('no_options_available') }}
	</BoNotice>

	<div v-else class="rounded-lg border border-gray-300 p-3 dark:border-gray-700">
		<BoForm
			v-if="usesCustomComponent === false"
			v-model="options"
			class="extension-options"
			:fields="optionsFields"
			:disabled="disabled"
			primary-key="+"
		/>

		<component
			:is="selectedDisplay.options as Component"
			v-else
			:value="value"
			:collection="collection"
			@input="emit('input', $event)"
		/>
	</div>
</template>
