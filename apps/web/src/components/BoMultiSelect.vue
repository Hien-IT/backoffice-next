<script setup lang="ts">
import {
	ComboboxAnchor,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxPortal,
	ComboboxRoot,
	ComboboxTrigger,
	ComboboxViewport,
} from 'reka-ui';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoChip from './BoChip.vue';
import BoIcon from './BoIcon.vue';

export type MultiSelectItem = { text: string; value: string | number; disabled?: boolean };
type Value = string | number;

const {
	modelValue = null,
	items,
	previewThreshold = 3,
	allowOther = false,
	allowNone = false,
	loading = false,
	disabled = false,
	nonEditable = false,
	invalid = false,
	error,
	hint,
	label,
	id: idProp,
	ariaLabelledby,
	ariaDescribedby,
} = defineProps<{
	modelValue?: Value[] | null;
	items: MultiSelectItem[];
	/** From this many selected values the trigger shows a count instead of chips (Directus previewThreshold). */
	previewThreshold?: number;
	/** Typed text that matches no item can be added as a value (Directus allowOther). */
	allowOther?: boolean;
	/** A "Deselect All" row that clears the value to null (Directus allowNone / showDeselect). */
	allowNone?: boolean;
	loading?: boolean;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	/** Directus v-select nonEditable: the list still opens (even when disabled, once there is a value) to show the
	 * selected values, which cannot be changed. */
	nonEditable?: boolean;
	invalid?: boolean;
	hint?: string;
	error?: string;
	id?: string | undefined;
	/** Form linking on the trigger (FormField ids), used when there is no own label; describedby is merged with the
	 * hint and error ids. */
	ariaLabelledby?: string | undefined;
	ariaDescribedby?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: Value[] | null] }>();

const { t } = useI18n();

const id = idProp ?? useId();
const labelId = `${id}-label`;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const labelledBy = computed(() => {
	const labelRef = label ? labelId : ariaLabelledby;
	return labelRef ? `${labelRef} ${id}` : undefined;
});
const describedBy = computed(
	() => [ariaDescribedby, hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
);

const DESELECT = '__bo_deselect_all__';

const open = ref(false);
const search = ref('');
const value = computed(() => modelValue ?? []);

// Directus v-select isDisabled.
const isDisabled = computed(() => disabled && !(nonEditable && value.value.length > 0));

// Selected values that are not items (added with allowOther) stay listed so they can be unchecked.
const otherValues = computed(() => value.value.filter((val) => !items.some((item) => item.value === val)));

const addText = computed(() => {
	const text = search.value.trim();
	if (!allowOther || !text) return null;
	const lower = text.toLowerCase();
	const known = [...items.map((item) => item.text), ...value.value.map(String)];
	return known.some((existing) => existing.toLowerCase() === lower) ? null : text;
});

const listItems = computed<MultiSelectItem[]>(() => [
	...items,
	...otherValues.value.map((val) => ({ text: String(val), value: val })),
]);

function textFor(val: Value) {
	return items.find((item) => item.value === val)?.text ?? String(val);
}

// Directus v-select displayValue: "All Items" or the item count once previewThreshold is reached.
const countText = computed(() =>
	value.value.length === items.length + otherValues.value.length ? t('all_items') : t('item_count', value.value.length),
);

function onSelect(event: Event, val: Value) {
	if (val !== DESELECT) return;
	event.preventDefault();
	emit('update:modelValue', null);
}

function onUpdate(newValue: unknown) {
	if (nonEditable) return;
	emit('update:modelValue', newValue as Value[]);
	search.value = '';
}

const TRIGGER =
	'flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-4 py-1.5 pe-10 text-start text-sm text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
const FIELD_VALID =
	'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-500 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const SEARCH =
	'h-9 w-full rounded-lg border border-gray-500 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400';
const CONTENT =
	'z-99999 max-h-(--reka-combobox-content-available-height) min-w-(--reka-combobox-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark';
const ITEM =
	'group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400';
// Checkbox box (visual only; Reka sets aria-selected on the option).
const BOX =
	'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] border-gray-500 text-white group-data-[state=checked]:border-brand-500 group-data-[state=checked]:bg-brand-500 dark:border-gray-500';
const NOTE = 'flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400';
</script>

<template>
	<div>
		<label
			v-if="label"
			:id="labelId"
			:for="id"
			class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90"
		>
			{{ label }}
		</label>
		<ComboboxRoot
			v-model:open="open"
			multiple
			:model-value="value"
			:disabled="isDisabled"
			@update:model-value="onUpdate"
		>
			<ComboboxAnchor class="relative">
				<!-- Reka makes the trigger tabindex -1 with an English name; here it is the focusable field. -->
				<ComboboxTrigger
					:id="id"
					tabindex="0"
					:aria-label="undefined"
					:aria-labelledby="labelledBy"
					:aria-describedby="describedBy"
					:aria-invalid="invalid || !!error ? 'true' : undefined"
					:class="[TRIGGER, invalid || error ? FIELD_INVALID : FIELD_VALID]"
					@keydown.down.prevent="open = true"
				>
					<span v-if="$slots['prepend']" data-prepend class="flex text-gray-500 dark:text-gray-400">
						<slot name="prepend" />
					</span>
					<span v-if="value.length === 0" class="py-1 text-gray-500 dark:text-gray-400">{{ placeholder }}</span>
					<template v-else-if="value.length < previewThreshold">
						<BoChip v-for="val in value" :key="val" :text="textFor(val)" />
					</template>
					<span v-else class="py-1">{{ countText }}</span>
					<BoIcon
						name="expand_more"
						size="sm"
						class="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
					/>
				</ComboboxTrigger>
			</ComboboxAnchor>
			<ComboboxPortal>
				<ComboboxContent position="popper" :side-offset="4" :class="CONTENT" :aria-busy="loading ? 'true' : undefined">
					<ComboboxInput
						v-model="search"
						:aria-label="t('search')"
						:placeholder="allowOther && !nonEditable ? t('other') : t('search')"
						:class="SEARCH"
						class="mb-2"
					/>
					<ComboboxViewport class="custom-scrollbar">
						<div v-if="loading" :class="NOTE">
							<BoIcon
								name="progress_activity"
								size="sm"
								class="animate-spin text-gray-500 motion-reduce:animate-none dark:text-gray-400"
							/>
							{{ t('loading') }}
						</div>
						<template v-else>
							<ComboboxItem
								v-if="allowNone && !nonEditable"
								:value="DESELECT"
								:text-value="t('deselect_all')"
								:disabled="value.length === 0"
								:class="ITEM"
								@select="onSelect($event, DESELECT)"
							>
								<BoIcon name="close" size="sm" />
								{{ t('deselect_all') }}
							</ComboboxItem>
							<div v-if="items.length === 0 && !allowOther" :class="NOTE">{{ t('no_options_available') }}</div>
							<ComboboxEmpty v-else :class="NOTE">{{ t('no_results') }}</ComboboxEmpty>
							<ComboboxItem
								v-for="item in listItems"
								:key="item.value"
								:value="item.value"
								:text-value="item.text"
								:disabled="item.disabled || nonEditable"
								:class="ITEM"
							>
								<span :class="BOX" aria-hidden="true">
									<BoIcon name="check" size="sm" class="hidden group-data-[state=checked]:inline" />
								</span>
								{{ item.text }}
							</ComboboxItem>
							<ComboboxItem v-if="addText && !nonEditable" :value="addText" :text-value="addText" :class="ITEM">
								<BoIcon name="add" size="sm" />
								{{ addText }}
							</ComboboxItem>
						</template>
					</ComboboxViewport>
				</ComboboxContent>
			</ComboboxPortal>
		</ComboboxRoot>
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
