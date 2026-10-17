<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/shared/extension-options.vue -->
<script setup lang="ts">
// Backoffice: VForm is BoForm, VNotice is BoNotice. An options component (the `list` and `map` interfaces, D-56
// lifted) is the config's `options` itself instead of a globally registered `<type>-options-<id>`; VErrorBoundary is
// onErrorCaptured showing the same warning notice.
import { isVueComponent } from '@directus/utils';
import { storeToRefs } from 'pinia';
import { type Component, computed, onErrorCaptured, type Ref, ref, toRefs } from 'vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import BoForm from '../../../../../../components/form/BoForm.vue';
import { useExtension } from '../../../../../../composables/use-extension.ts';
import { useFieldDetailStore } from '../store/index.ts';

const props = withDefaults(
	defineProps<{
		type: 'interface' | 'display' | 'operation' | 'panel';
		extension?: string | null | undefined;
		showAdvanced?: boolean;
		options?: Record<string, any> | undefined;
		modelValue?: Record<string, any> | null | undefined;
		disabled?: boolean;
		rawEditorEnabled?: boolean;
	}>(),
	{
		extension: undefined,
		options: undefined,
		modelValue: () => ({}),
	},
);

const emit = defineEmits(['update:modelValue']);

// Backoffice (spec 017 FR-042): the operation drawer has no field detail store and always passes `options` (the
// operation's array or the result of its options function), so the operations registry stays out of this chunk. The
// panel drawer of feature 018 does the same with the panel registry.
const standalone = props.type === 'operation' || props.type === 'panel';
const { collection, field } = standalone
	? { collection: ref(null), field: ref(null) }
	: storeToRefs(useFieldDetailStore());
const { extension, type } = toRefs(props);

const extensionInfo = standalone ? ref(null) : useExtension(type as Ref<'interface' | 'display'>, extension);

const usesCustomComponent = computed(() => {
	if (!extensionInfo.value) return false;

	return isVueComponent(extensionInfo.value.options);
});

const optionsFields = computed(() => {
	if (usesCustomComponent.value === true) return [];

	let optionsObjectOrArray;

	if (props.options) {
		optionsObjectOrArray = props.options;
	} else {
		if (!extensionInfo.value) return [];
		if (!extensionInfo.value?.options) return [];
		optionsObjectOrArray = extensionInfo.value.options as any;
	}

	if (!optionsObjectOrArray) return [];

	if (Array.isArray(optionsObjectOrArray)) return optionsObjectOrArray;

	if (props.showAdvanced) {
		return [...optionsObjectOrArray.standard, ...optionsObjectOrArray.advanced];
	}

	return optionsObjectOrArray.standard;
});

const optionsValues = computed({
	get() {
		return props.modelValue ?? {};
	},
	set(values: Record<string, any>) {
		emit('update:modelValue', values);
	},
});

const componentError = ref(false);

onErrorCaptured(() => {
	componentError.value = true;
	return false;
});
</script>

<template>
	<BoNotice v-if="usesCustomComponent === false && optionsFields.length === 0">
		{{ $t('no_options_available') }}
	</BoNotice>

	<BoForm
		v-else-if="usesCustomComponent === false"
		v-model="optionsValues"
		class="extension-options"
		:fields="optionsFields"
		:initial-values="disabled ? optionsValues : null"
		:disabled="disabled"
		:raw-editor-enabled="rawEditorEnabled"
		primary-key="+"
	/>

	<BoNotice v-else-if="componentError" type="warning">{{ $t('unexpected_error') }}</BoNotice>

	<component
		:is="extensionInfo!.options as Component"
		v-else
		:value="optionsValues"
		:collection="collection"
		:field="field"
		@input="optionsValues = $event"
	/>
</template>
