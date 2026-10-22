<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';
import { computed, nextTick, ref, toRef, useId, useTemplateRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { type OtherValue, useCustomSelectionMultiple } from '../composables/use-custom-selection.ts';
import BoIcon from './BoIcon.vue';

export type CheckboxGroupItem = { text: string; value: string | number; disabled?: boolean };
type Value = string | number;

const {
	modelValue = null,
	items,
	columns = 1,
	itemsShown = 8,
	allowOther = false,
	iconOn,
	iconOff,
	color,
	disabled = false,
	invalid = false,
	required = false,
	error,
	hint,
	label,
	id: idProp,
} = defineProps<{
	modelValue?: Value[] | null;
	items: CheckboxGroupItem[];
	label?: string;
	/** Columns from sm up (Directus getMinimalGridClass: grid-2/3/4). */
	columns?: 1 | 2 | 3 | 4;
	/** Choices shown before "Show N more" (Directus select-multiple-checkbox itemsShown). */
	itemsShown?: number;
	/** Rows with free text values (Directus allowOther). */
	allowOther?: boolean;
	/** Custom Material Symbols names for the checked / unchecked states (Directus iconOn / iconOff). */
	iconOn?: string;
	iconOff?: string;
	/** Data color of checked boxes (Directus `color` option), applied with style. */
	color?: string;
	disabled?: boolean;
	invalid?: boolean;
	required?: boolean;
	hint?: string;
	error?: string;
	id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: Value[] | null] }>();

const { t } = useI18n();

const id = idProp ?? useId();
const labelId = `${id}-label`;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const gridId = `${id}-grid`;

const root = useTemplateRef('root');

const value = computed(() => modelValue ?? []);

// Directus select-multiple-checkbox: show more / choicesDisplayed / hiddenCount.
const showAll = ref(false);
const hideChoices = computed(() => items.length > itemsShown);
const choicesDisplayed = computed(() => (showAll.value || !hideChoices.value ? items : items.slice(0, itemsShown)));
const hiddenCount = computed(() => items.length - itemsShown);

const { otherValues, addOtherValue, setOtherValue } = useCustomSelectionMultiple(
	toRef(() => modelValue) as Ref<string[] | null>,
	toRef(() => items),
	(newValue) => emit('update:modelValue', newValue),
);

function onBlurCustomInput(otherVal: OtherValue) {
	return (otherVal.value === null || otherVal.value?.length === 0) && setOtherValue(otherVal.key, null);
}

// Backoffice: Directus autofocuses the new row's input on mount (autofocus-custom-input).
async function addOther() {
	addOtherValue('', true);
	await nextTick();
	[...(root.value?.querySelectorAll<HTMLInputElement>('[data-other-input] input') ?? [])].at(-1)?.focus();
}

function toggle(val: Value, checked: boolean) {
	emit('update:modelValue', checked ? [...value.value, val] : value.value.filter((v) => v !== val));
}

const GRID = {
	1: 'grid-cols-1',
	2: 'grid-cols-1 sm:grid-cols-2',
	3: 'grid-cols-1 sm:grid-cols-3',
	4: 'grid-cols-1 sm:grid-cols-4',
};
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const BOX =
	'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.25px] bg-transparent text-white focus-visible:outline-2 focus-visible:outline-offset-2 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[disabled]:cursor-not-allowed data-[disabled]:border-gray-200 data-[disabled]:bg-transparent data-[disabled]:text-gray-200 dark:data-[disabled]:border-gray-800 dark:data-[disabled]:text-gray-800';
const ICON_BOX =
	'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 data-[state=checked]:text-brand-500 dark:text-gray-400 dark:data-[state=checked]:text-brand-400 data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-200 dark:data-[disabled]:text-gray-800';
const VALID =
	'border-gray-300 hover:border-brand-500 focus-visible:outline-brand-500 dark:border-gray-700 dark:hover:border-brand-400 dark:focus-visible:outline-brand-400';
const INVALID =
	'border-error-600 focus-visible:outline-error-600 dark:border-error-400 dark:focus-visible:outline-error-400';
const OTHER_INPUT =
	'h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-white/[0.03]';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
const LINK_BTN = `mt-3 inline-flex items-center gap-1 rounded text-theme-sm font-medium text-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400 ${FOCUS}`;

function boxStyle(checked: boolean): Record<string, string> {
	if (!checked || !color) return {};
	return iconOn || iconOff ? { color } : { borderColor: color, backgroundColor: color };
}
</script>

<template>
	<div ref="root">
		<span v-if="label" :id="labelId" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
			<span v-if="required" class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
		</span>
		<div
			:id="gridId"
			role="group"
			:aria-labelledby="label ? labelId : undefined"
			:aria-describedby="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined"
			class="grid gap-x-6 gap-y-3"
			:class="GRID[columns]"
		>
			<div
				v-for="(item, index) in choicesDisplayed"
				:key="item.value"
				class="flex items-center gap-3 text-sm font-normal select-none"
				:class="disabled || item.disabled ? 'text-gray-300 dark:text-gray-700' : 'text-gray-700 dark:text-gray-300'"
			>
				<CheckboxRoot
					:id="`${id}-${index}`"
					v-slot="{ state }"
					:model-value="value.includes(item.value)"
					:disabled="disabled || !!item.disabled"
					:aria-invalid="invalid || !!error ? 'true' : undefined"
					:class="[iconOn || iconOff ? ICON_BOX : BOX, invalid || error ? INVALID : VALID]"
					:style="boxStyle(value.includes(item.value))"
					@update:model-value="toggle(item.value, $event === true)"
				>
					<BoIcon
						v-if="iconOn || iconOff"
						:name="(state === true ? iconOn : iconOff) ?? (state === true ? 'check_box' : 'check_box_outline_blank')"
					/>
					<CheckboxIndicator v-else><BoIcon name="check" size="sm" /></CheckboxIndicator>
				</CheckboxRoot>
				<label :for="`${id}-${index}`" :class="disabled || item.disabled ? 'cursor-not-allowed' : 'cursor-pointer'">
					{{ item.text }}
				</label>
			</div>
			<template v-if="allowOther">
				<div v-for="otherVal in otherValues" :key="otherVal.key" data-other-input class="flex items-center gap-3">
					<CheckboxRoot
						:model-value="!!otherVal.value && value.includes(otherVal.value)"
						:disabled="disabled || !otherVal.value"
						:aria-label="otherVal.value || t('other')"
						:class="[iconOn || iconOff ? ICON_BOX : BOX, invalid || error ? INVALID : VALID]"
						:style="boxStyle(!!otherVal.value && value.includes(otherVal.value))"
						@update:model-value="toggle(otherVal.value, $event === true)"
					>
						<BoIcon
							v-if="iconOn || iconOff"
							:name="
								(value.includes(otherVal.value) ? iconOn : iconOff) ??
								(value.includes(otherVal.value) ? 'check_box' : 'check_box_outline_blank')
							"
						/>
						<CheckboxIndicator v-else><BoIcon name="check" size="sm" /></CheckboxIndicator>
					</CheckboxRoot>
					<input
						:value="otherVal.value"
						:aria-label="t('other')"
						:disabled="disabled"
						:class="OTHER_INPUT"
						@input="setOtherValue(otherVal.key, ($event.target as HTMLInputElement).value)"
						@blur="onBlurCustomInput(otherVal)"
					/>
					<button
						type="button"
						:class="ICON_BTN"
						:disabled="disabled"
						:aria-label="t('remove_item')"
						@click="setOtherValue(otherVal.key, null)"
					>
						<BoIcon name="delete" />
					</button>
				</div>
			</template>
		</div>
		<p v-if="!items.length && !allowOther" class="text-theme-sm text-gray-500 dark:text-gray-400">
			{{ t('no_options_available') }}
		</p>
		<div class="flex flex-wrap gap-x-6">
			<button
				v-if="hideChoices"
				type="button"
				:class="LINK_BTN"
				:aria-expanded="showAll ? 'true' : 'false'"
				:aria-controls="gridId"
				@click="showAll = !showAll"
			>
				<BoIcon :name="showAll ? 'expand_less' : 'expand_more'" size="sm" />
				{{ showAll ? t('show_less') : t('interfaces.select-multiple-checkbox.show_more', { count: hiddenCount }) }}
			</button>
			<button v-if="allowOther" type="button" :class="LINK_BTN" :disabled="disabled" @click="addOther">
				<BoIcon name="add" size="sm" />
				{{ t('other') }}
			</button>
		</div>
		<p v-if="hint" :id="hintId" class="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
			class="mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400"
		>
			<BoIcon name="error" size="sm" />
			{{ error }}
		</p>
	</div>
</template>
