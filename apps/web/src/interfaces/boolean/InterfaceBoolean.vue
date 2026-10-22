<!-- Ported from directus/app/src/interfaces/boolean/boolean.vue -->
<script setup lang="ts">
// Backoffice: VCheckbox in `block` mode (directus/app/src/components/v-checkbox.vue: a field-sized button with the
// iconOn / iconOff / indeterminate icon and the label) on the FIELD classes; BoCheckbox has no icon or block mode.
// colorOn / colorOff are data colors set by `style` (Q-C); without them the theme brand / gray classes apply.
// The button is named by the form label and its own label text (aria-labelledby, FR-094); `aria-checked` carries
// the state ("mixed" for null), so it is not shown by color alone.
import { computed, inject, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

// Backoffice: the form props (type, collection...) must not reach the button (type="boolean" would make it submit).
defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		value: boolean | null;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		label?: string | undefined;
		iconOn?: string;
		iconOff?: string;
		colorOn?: string | undefined;
		colorOff?: string | undefined;
	}>(),
	{
		iconOn: 'check_box',
		iconOff: 'check_box_outline_blank',
		colorOn: undefined,
		colorOff: undefined,
	},
);

const emit = defineEmits<{
	(e: 'input', value: boolean | null): void;
}>();

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);
const textId = useId();

// v-checkbox.vue icon(): null is indeterminate.
const icon = computed(() => {
	if (props.value === null) return 'indeterminate_check_box';
	return props.value === true ? props.iconOn : props.iconOff;
});

const greyed = computed(() => props.disabled && !props.nonEditable);

const iconStyle = computed(() => {
	if (greyed.value) return undefined;
	const color = props.value === true ? props.colorOn : props.colorOff;
	return color ? { color } : undefined;
});

const iconClass = computed(() => {
	if (greyed.value) return 'text-gray-300 dark:text-gray-700';
	if (iconStyle.value) return '';
	return props.value === true ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400';
});

// v-checkbox.vue toggleInput(): `!modelValue`, so null becomes true.
function toggleInput() {
	if (props.disabled) return;
	emit('input', !props.value);
}

const invalid = computed(() => !!a11y?.value.invalid);
</script>

<template>
	<button
		type="button"
		role="checkbox"
		:aria-checked="value === null ? 'mixed' : value === true ? 'true' : 'false'"
		:aria-labelledby="a11y ? `${a11y.labelId} ${textId}` : undefined"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="invalid ? 'true' : undefined"
		:disabled="disabled"
		class="flex h-11 w-full items-center gap-2 rounded-lg border px-3 text-start text-sm shadow-theme-xs focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-gray-900"
		:class="[
			invalid
				? 'border-error-600 focus-visible:outline-error-600 dark:border-error-400 dark:focus-visible:outline-error-400'
				: 'border-gray-300 hover:border-brand-500 focus-visible:outline-brand-500 dark:border-gray-700 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400',
			greyed
				? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-100 dark:border-gray-800 dark:bg-white/[0.03]'
				: 'text-gray-800 dark:text-white/90',
			{ 'cursor-not-allowed': disabled },
		]"
		@click.stop="toggleInput"
	>
		<BoIcon data-icon :name="icon" :class="iconClass" :style="iconStyle" />
		<span :id="textId" class="min-w-0 flex-1 truncate">{{ label || t('enabled') }}</span>
	</button>
</template>
