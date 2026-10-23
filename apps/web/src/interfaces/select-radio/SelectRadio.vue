<!-- Ported from directus/app/src/interfaces/select-radio/select-radio.vue -->
<script setup lang="ts">
// Backoffice: the VRadio list is BoRadio (Radio recipe, grid from getMinimalGridClass); the "other" row keeps the
// DR markup (icon button + input) with the recipe classes. `color` defaults to the theme brand color (BoRadio
// classes) instead of `var(--theme--primary)`; the default iconOn/iconOff draw the recipe radio, other icons are shown.
import { computed, inject, toRefs, useId, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import BoRadio from '../../components/BoRadio.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { useCustomSelection } from '../../composables/use-custom-selection.ts';
import { getMinimalGridClass } from '../../utils/get-minimal-grid-class.ts';

type Option = {
	text: string;
	value: string | number | boolean;
};

const props = withDefaults(
	defineProps<{
		value: string | number | null;
		disabled?: boolean;
		nonEditable?: boolean;
		choices?: Option[] | undefined;
		allowOther?: boolean;
		width?: string | undefined;
		iconOn?: string;
		iconOff?: string;
		color?: string | undefined;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		choices: undefined,
		allowOther: false,
		width: undefined,
		iconOn: 'radio_button_checked',
		iconOff: 'radio_button_unchecked',
		color: undefined,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
const fallbackId = useId();
const fieldId = computed(() => a11y?.value.inputId ?? fallbackId);
const invalid = computed(() => a11y?.value.invalid ?? false);

const customInput = useTemplateRef<HTMLInputElement>('customInput');

const { choices, value } = toRefs(props);

// Backoffice: BoRadio takes string and number values (boolean choice values are not supported).
const items = computed(() => (choices.value || []) as (Option & { value: string | number })[]);

const gridClass = computed(() => getMinimalGridClass(items.value, props.width));

const { otherValue, usesOtherValue } = useCustomSelection(value as any, items as any, (value) => emit('input', value));

const customIcon = computed(() => {
	if (!otherValue.value) return 'add';
	if (otherValue.value && usesOtherValue.value === true) return props.iconOn;
	return props.iconOff;
});

const columns = computed(() => Number(gridClass.value?.slice('grid-'.length) ?? 1) as 1 | 2 | 3 | 4);

const customIcons = computed(() => props.iconOn !== 'radio_button_checked' || props.iconOff !== 'radio_button_unchecked');

const otherActive = computed(() => (!props.disabled || props.nonEditable) && usesOtherValue.value);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoNotice v-if="!items" type="warning">
		{{ t('choices_option_configured_incorrectly') }}
	</BoNotice>
	<div
		v-else
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		class="space-y-3"
	>
		<BoRadio
			:id="fieldId"
			:model-value="value"
			:items="items"
			:columns="columns"
			:color="color ?? ''"
			v-bind="customIcons ? { iconOn, iconOff } : {}"
			:disabled="disabled"
			:invalid="invalid"
			@update:model-value="emit('input', $event)"
		/>
		<BoNotice v-if="items.length === 0 && !allowOther" type="info">
			{{ t('no_options_available') }}
		</BoNotice>
		<div
			v-if="allowOther && !(nonEditable && !usesOtherValue && !otherValue)"
			data-custom
			class="flex h-11 w-full items-center gap-2 rounded-lg border px-2 focus-within:ring-3 focus-within:ring-brand-500/10"
			:class="[
				otherActive
					? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
					: otherValue
						? 'border-transparent bg-gray-100 dark:bg-white/5'
						: 'border-dashed border-gray-300 dark:border-gray-700',
				disabled && !nonEditable ? 'cursor-not-allowed bg-gray-50 dark:bg-white/[0.03]' : '',
			]"
			:style="otherActive && color ? { borderColor: color } : {}"
		>
			<button
				type="button"
				class="inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed"
				:class="[FOCUS, otherActive ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400']"
				:style="otherActive && color ? { color } : {}"
				:disabled="disabled"
				:aria-label="t('other')"
				:aria-pressed="otherActive ? 'true' : 'false'"
				@click="otherValue ? emit('input', otherValue) : customInput?.focus()"
			>
				<BoIcon :name="customIcon" />
			</button>
			<input
				ref="customInput"
				v-model="otherValue"
				:aria-label="t('other')"
				:placeholder="t('other')"
				:disabled="disabled"
				class="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-hidden placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white/90 dark:placeholder:text-gray-400"
				@change="emit('input', otherValue)"
			/>
		</div>
	</div>
</template>
