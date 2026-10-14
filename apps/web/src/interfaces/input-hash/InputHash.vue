<!-- Ported from directus/app/src/interfaces/input-hash/input-hash.vue -->
<script setup lang="ts">
// Backoffice: VInput is ../input/InputField.vue (port of v-input.vue); the stored hash never reaches the input
// (FR-066): the input starts empty and shows `value_securely_stored` with a lock icon while a hash is stored.
// Monospace font and the primary (hashed) / warning (open) lock colors as in Directus, from the theme.
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import InputField from '../input/InputField.vue';

const props = defineProps<{
	value: string | null;
	disabled?: boolean | undefined;
	nonEditable?: boolean | undefined;
	placeholder?: string | undefined;
	masked?: boolean | undefined;
	autocomplete?: string | undefined;
}>();

const emit = defineEmits(['input']);

defineOptions({
	inheritAttrs: false,
});

const { t } = useI18n();

const isHashed = ref(false);
const localValue = ref<string | null>(null);

const autocomplete = computed(() => {
	if (props.autocomplete) return props.autocomplete;

	if (props.masked) return 'new-password';

	return 'off';
});

const internalPlaceholder = computed(() => {
	return isHashed.value ? t('value_securely_stored') : props.placeholder;
});

watch(
	() => props.value,
	() => {
		isHashed.value = !!(props.value && props.value.length > 0);
	},
	{ immediate: true },
);

function emitValue(newValue: string) {
	emit('input', newValue);
	localValue.value = newValue;
}

const hashed = computed(() => isHashed.value && !localValue.value);
</script>

<template>
	<InputField
		:placeholder="internalPlaceholder"
		:disabled
		:non-editable
		:type="masked ? 'password' : 'text'"
		:autocomplete
		:model-value="localValue"
		class="font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]"
		:class="{
			'[&_input]:placeholder:text-brand-500 dark:[&_input]:placeholder:text-brand-400':
				hashed && (!disabled || nonEditable),
		}"
		:data-hashed="hashed || undefined"
		@update:model-value="emitValue"
	>
		<template #append>
			<BoIcon
				data-lock
				:name="hashed ? 'lock' : 'lock_open'"
				:class="
					disabled && !(hashed && nonEditable)
						? 'text-gray-500 dark:text-gray-400'
						: hashed
							? 'text-brand-500 dark:text-brand-400'
							: 'text-warning-600 dark:text-warning-500'
				"
			/>
		</template>
	</InputField>
</template>
