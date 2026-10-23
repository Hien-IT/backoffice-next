<!-- Ported from directus/app/src/interfaces/select-dropdown/select-dropdown.vue -->
<script setup lang="ts">
// Backoffice: VSelect is the Select recipe on Reka Select (choice icon or color dot, "Deselect" row, the selected
// choice's icon in the trigger like the VSelect prepend, the VSelect search row above 10 choices). With allowOther it is
// BoCombobox, where the typed text becomes the value (Combobox recipe) and allowNone is a clear button next to the
// field, as BoCombobox has no deselect row.
import { isEmpty, isEqual } from 'lodash-es';
import {
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectSeparator,
	SelectTrigger,
	SelectViewport,
} from 'reka-ui';
import { computed, inject, ref, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoCombobox from '../../components/BoCombobox.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoSearchClear from '../../components/BoSearchClear.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

type Option = {
	text: string;
	value: string | number | boolean;
	icon?: string | null;
	color?: string | null;
	children?: Option[];
	/** A line between choices (`{ divider: true }`, the metric panel function), as the Directus v-select. */
	divider?: boolean;
	disabled?: boolean;
};

const isChoice = (item: Option) => item.divider !== true;

const props = withDefaults(
	defineProps<{
		value: string | number | null;
		disabled?: boolean;
		nonEditable?: boolean;
		choices?: Option[] | undefined;
		icon?: string | undefined;
		allowNone?: boolean;
		placeholder?: string | undefined;
		allowOther?: boolean;
	}>(),
	{
		disabled: false,
		nonEditable: false,
		choices: undefined,
		icon: undefined,
		allowNone: false,
		placeholder: undefined,
		allowOther: false,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

// Backoffice: ids and state of the form field (label, note, validation message), FormField.vue.
const a11y = inject(FORM_FIELD_A11Y, null);
const fallbackId = useId();
const fieldId = computed(() => a11y?.value.inputId ?? fallbackId);
const invalid = computed(() => !!a11y?.value.invalid);

const applyGlobalIcon = computed(() => props.choices?.some((choice) => choice.icon));

const items = computed(() => {
	if (!props.choices) {
		return [];
	}

	if (!applyGlobalIcon.value) {
		return props.choices;
	}

	return props.choices.map((choice) => {
		const choiceCopy = { ...choice };

		if (!choiceCopy.icon && !choiceCopy.color) {
			choiceCopy.icon = props.icon ?? null;
		}

		return choiceCopy;
	});
});

const showGlobalIcon = computed(() => {
	if (!props.icon) {
		return false;
	}

	if (!applyGlobalIcon.value) {
		return true;
	}

	if (isEmpty(props.value)) {
		return true;
	}

	return false;
});

watch(
	() => props.choices,
	(newChoices, oldChoices) => {
		if (
			props.value !== null &&
			!isEqual(newChoices, oldChoices) &&
			!newChoices?.some((choice) => choice.value === props.value)
		) {
			// Reset if the options have dynamically changed and the current value is not available anymore
			emit('input', null);
		}
	},
);

// Backoffice: VSelect displayValue and its prepend slot (global icon, else the choice icon, else its color dot).
const selectedItem = computed(() => items.value.find((item) => isChoice(item) && item.value === props.value));

// A choice whose value is null (the appearance "Default (Sync with Project)" of directus_users) shows its text when the
// value is null, as the Directus v-select does.
const displayText = computed(() => {
	if (selectedItem.value) return String(selectedItem.value.text || props.value);
	return props.value === null || props.value === undefined ? '' : String(props.value);
});

const prepend = computed(() => {
	if (showGlobalIcon.value) return { icon: props.icon!, color: null };
	if (selectedItem.value?.icon) return { icon: selectedItem.value.icon, color: selectedItem.value.color ?? null };
	if (selectedItem.value?.color) return { icon: null, color: selectedItem.value.color };
	return null;
});

// Backoffice: Reka and BoCombobox take string and number values (boolean choice values are not supported).
const selectItems = computed(() => items.value as (Option & { value: string | number })[]);
const choiceItems = computed(() => selectItems.value.filter(isChoice));

// Directus v-select: a search row when there are more than 10 items; it filters on text or value.
// Backoffice: no 250ms debounce (local filter).
const open = ref(false);
const search = ref('');
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');

function clearSearch() {
	search.value = '';
	searchInput.value?.focus();
}
const showSearch = computed(() => selectItems.value.length > 10 || !!search.value);

const visibleItems = computed(() => {
	const searchValue = search.value.toLowerCase();
	if (!searchValue) return selectItems.value;
	return selectItems.value.filter(
		(item) =>
			String(item.text ?? '')
				.toLowerCase()
				.includes(searchValue) ||
			String(item.value ?? '')
				.toLowerCase()
				.includes(searchValue),
	);
});

// Directus autofocuses the search input: Reka focuses the selected item once the list is placed, the first focus
// that lands in the list after opening is moved to the input.
let focusSearch = false;
watch(open, (value) => (focusSearch = value));

function onContentFocusin() {
	if (!focusSearch) return;
	focusSearch = false;
	searchInput.value?.focus();
}

// Typed characters (and Home/End) stay in the search input instead of the Reka typeahead; arrows still reach the list.
function onSearchKeydown(event: KeyboardEvent) {
	if (event.key.length === 1 || event.key === 'Home' || event.key === 'End') event.stopPropagation();
}

// Reka Select items cannot have an empty value: the "Deselect" row uses this one and emits null.
const DESELECT = '__bo_deselect__';
// ...nor an empty value: a choice whose value is '' (tags `whitespace` "remove") uses this one.
const EMPTY = '__bo_empty__';
// ...nor a null value: a choice whose value is null uses this one.
const NULL_CHOICE = '__bo_null__';
const hasNullChoice = computed(() => items.value.some((item) => isChoice(item) && item.value === null));

/** The Reka value of a choice or of the field value. */
function toSelectValue(value: unknown) {
	if (value === '') return EMPTY;
	if (value === null || value === undefined) return hasNullChoice.value && value === null ? NULL_CHOICE : '';
	return value;
}

function onSelect(value: unknown) {
	emit('input', value === DESELECT || value === NULL_CHOICE ? null : value === EMPTY ? '' : value);
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
// component-specs Select trigger = FIELD + FIELD_INVALID / FIELD_DISABLED.
const TRIGGER =
	'flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-4 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
const FIELD_VALID = `border-gray-300 focus:border-brand-500 focus:ring-brand-500/10 ${FOCUS} dark:border-gray-700 dark:focus:border-brand-400`;
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const CONTENT =
	'z-99999 max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark';
const ITEM =
	'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400';
const SEARCH =
	'h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400';
const NOTE = 'px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
const DOT = 'h-3 w-3 shrink-0 rounded-full';
</script>

<template>
	<div v-if="allowOther" class="flex items-center gap-2">
		<BoCombobox
			:id="a11y?.inputId"
			class="min-w-0 flex-1"
			:aria-describedby="a11y?.describedBy"
			:model-value="value"
			:items="choiceItems"
			item-icon="icon"
			item-color="color"
			allow-other
			:disabled="disabled"
			:invalid="invalid"
			:placeholder="placeholder || t('select_an_item')"
			@update:model-value="emit('input', $event)"
		>
			<template v-if="showGlobalIcon" #prepend>
				<BoIcon :name="icon!" size="sm" />
			</template>
		</BoCombobox>
		<button
			v-if="allowNone && !nonEditable && value !== null"
			type="button"
			:class="ICON_BTN"
			:disabled="disabled"
			:aria-label="t('deselect')"
			@click="emit('input', null)"
		>
			<BoIcon name="close" />
		</button>
	</div>
	<SelectRoot
		v-else
		v-model:open="open"
		:model-value="toSelectValue(value)"
		:disabled="disabled"
		@update:model-value="onSelect"
	>
		<SelectTrigger
			:id="fieldId"
			:aria-labelledby="a11y ? `${a11y.labelId} ${fieldId}` : undefined"
			:aria-describedby="a11y?.describedBy"
			:aria-invalid="invalid ? 'true' : undefined"
			:class="[TRIGGER, invalid ? FIELD_INVALID : FIELD_VALID]"
		>
			<span class="flex min-w-0 items-center gap-2">
				<span v-if="prepend" data-prepend class="flex text-gray-500 dark:text-gray-400">
					<BoIcon
						v-if="prepend.icon"
						:name="prepend.icon"
						size="sm"
						:style="prepend.color ? { color: prepend.color } : {}"
					/>
					<span v-else :class="DOT" :style="{ backgroundColor: prepend.color! }" aria-hidden="true" />
				</span>
				<span v-if="displayText" class="truncate">{{ displayText }}</span>
				<span v-else class="truncate text-gray-500 dark:text-gray-400">{{ placeholder || t('select_an_item') }}</span>
			</span>
			<BoIcon name="expand_more" size="sm" class="text-gray-500 dark:text-gray-400" />
		</SelectTrigger>
		<SelectPortal>
			<SelectContent position="popper" :side-offset="4" :class="CONTENT" @focusin="onContentFocusin">
				<div v-if="showSearch" class="relative mb-2">
					<input
						ref="searchInput"
						v-model="search"
						type="search"
						autocomplete="off"
						:aria-label="t('search')"
						:placeholder="t('search')"
						:class="[SEARCH, { 'pe-10!': search }]"
						@keydown="onSearchKeydown"
					/>
					<BoSearchClear v-if="search" @click="clearSearch" />
				</div>
				<SelectViewport class="custom-scrollbar">
					<template v-if="allowNone && !nonEditable">
						<SelectItem :value="DESELECT" :disabled="value === null" :class="ITEM">
							<SelectItemText>{{ t('deselect') }}</SelectItemText>
							<BoIcon name="close" size="sm" />
						</SelectItem>
						<SelectSeparator class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
					</template>
					<p v-if="items.length === 0" :class="NOTE">{{ t('no_options_available') }}</p>
					<template v-for="(item, index) in visibleItems" :key="item.divider ? `divider-${index}` : String(item.value)">
						<SelectSeparator v-if="item.divider" class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
						<SelectItem v-else :value="toSelectValue(item.value)" :disabled="item.disabled === true" :class="ITEM">
							<span class="flex min-w-0 items-center gap-2">
								<BoIcon v-if="item.icon" :name="item.icon" size="sm" :style="item.color ? { color: item.color } : {}" />
								<span v-else-if="item.color" :class="DOT" :style="{ backgroundColor: item.color }" aria-hidden="true" />
								<SelectItemText>{{ item.text }}</SelectItemText>
							</span>
							<SelectItemIndicator><BoIcon name="check" size="sm" /></SelectItemIndicator>
						</SelectItem>
					</template>
				</SelectViewport>
			</SelectContent>
		</SelectPortal>
	</SelectRoot>
</template>
