<!-- Ported from directus/app/src/interfaces/tags/tags.vue -->
<script setup lang="ts">
// Backoffice: TagsInput recipe (component-specs Tier 3). BoTagsInput (Reka) holds the input and the custom tags
// (Enter, comma, blur, paste add; Backspace removes); the presets are toggle chips below it, so a selected preset is
// shown once (DR shows presets first, then the custom tags after a chevron). The icons sit over the input.
// The processing rules (processArray) and the emitted values are those of DR.
import formatTitle from '@directus/format-title';
import { computed, inject, ref, watch } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTagsInput from '../../components/BoTagsInput.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

const props = withDefaults(
	defineProps<{
		value: string[] | string | null;
		disabled?: boolean;
		nonEditable?: boolean;
		placeholder?: string | undefined;
		whitespace?: string | null | undefined;
		capitalization?: string | null | undefined;
		alphabetize?: boolean;
		iconLeft?: string | undefined;
		iconRight?: string;
		presets?: string[] | undefined;
		allowCustom?: boolean;
		direction?: string | undefined;
		rawEditorEnabled?: boolean;
	}>(),
	{
		placeholder: undefined,
		whitespace: undefined,
		capitalization: undefined,
		iconLeft: undefined,
		iconRight: 'local_offer',
		presets: undefined,
		allowCustom: true,
		direction: undefined,
	},
);

defineOptions({ name: 'InterfaceTags' });

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const presetVals = computed<string[]>(() => {
	if (props.presets !== undefined) return processArray(props.presets);
	return [];
});

// Variable mode: when `rawEditorEnabled` is true and the value is a string rather than an array.
// This happens in contexts like Flows and Insights where the field value can be a dynamic
// variable expression (e.g. "{{$trigger.body.tags}}") instead of an array of tags.
const isVariableMode = computed(() => props.rawEditorEnabled === true && typeof props.value === 'string');

const selectedValsLocal = ref<string[]>(Array.isArray(props.value) ? processArray(props.value) : []);

watch(
	() => props.value,
	(newVal) => {
		if (Array.isArray(newVal)) {
			selectedValsLocal.value = processArray(newVal);
		}

		if (newVal === null) selectedValsLocal.value = [];
	},
);

const selectedVals = computed<string[]>(() => {
	let vals = processArray(selectedValsLocal.value);

	if (!props.allowCustom) {
		vals = vals.filter((val) => presetVals.value.includes(val));
	}

	return vals;
});

const customVals = computed<string[]>(() => {
	return selectedVals.value.filter((val) => !presetVals.value.includes(val));
});

function processArray(array: string[]): string[] {
	array = array.map((val) => {
		val = val.trim();
		if (props.capitalization === 'uppercase') val = val.toUpperCase();
		if (props.capitalization === 'lowercase') val = val.toLowerCase();

		const whitespace = props.whitespace === undefined || props.whitespace === null ? ' ' : props.whitespace;

		if (props.capitalization === 'auto-format') val = formatTitle(val, new RegExp(whitespace));

		val = val.replace(/ +/g, whitespace);

		return val;
	});

	if (props.alphabetize) {
		array = array.concat().sort();
	}

	array = [...new Set(array)];

	return array;
}

// Backoffice: replaces the DR keydown/blur handler; BoTagsInput reports the new custom list (one tag added on
// Enter, comma, blur or paste, or one removed), turned back into the DR addTag/removeTag calls.
function onCustomUpdate(next: string[]) {
	if (isVariableMode.value) return;

	const removed = customVals.value.filter((tag) => !next.includes(tag));
	const added = next.filter((tag) => !customVals.value.includes(tag));

	if (removed.length > 0) selectedValsLocal.value = selectedValsLocal.value.filter((tag) => !removed.includes(tag));

	for (const tag of added) {
		if (!tag || tag === '') continue;
		selectedValsLocal.value.push(tag.trim());
	}

	emitValue();
}

function toggleTag(tag: string) {
	if (selectedVals.value.includes(tag)) {
		removeTag(tag);
	} else {
		addTag(tag);
	}
}

function addTag(tag: string) {
	if (!tag || tag === '') return;
	// Remove any leading / trailing whitespace from the value
	tag = tag.trim();
	selectedValsLocal.value.push(tag);
	emitValue();
}

function removeTag(tag: string) {
	selectedValsLocal.value = selectedValsLocal.value.filter((savedTag) => savedTag !== tag);
	emitValue();
}

function emitValue() {
	emit('input', selectedVals.value);
}

// Backoffice: optional BoTagsInput props are left out when unset (exactOptionalPropertyTypes).
const tagsInputProps = computed(() => ({
	...(a11y ? { id: a11y.value.inputId, ariaDescribedby: a11y.value.describedBy } : {}),
	...(props.placeholder ? { placeholder: props.placeholder } : {}),
}));

function clearVariable() {
	emit('input', null);
}

// component-specs FIELD / FIELD_DISABLED / FOCUS / ICON_BTN, Chip and TagsInput presets.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FIELD_DISABLED =
	'h-11 w-full cursor-not-allowed rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-error-400 ${FOCUS}`;
const ICON = 'pointer-events-none absolute top-0 flex h-11 items-center text-gray-500 dark:text-gray-400';
const CHIP =
	'inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80';
const PRESET_OFF = `inline-flex items-center gap-1 rounded-full bg-transparent px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 ring-1 ring-gray-500 ring-inset hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/80 dark:hover:bg-white/5 ${FOCUS}`;
const PRESET_ON = `${CHIP} hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10 ${FOCUS}`;
</script>

<template>
	<div class="interface-tags" :dir="direction">
		<div v-if="isVariableMode" class="relative">
			<input
				:id="a11y?.inputId"
				:value="value as string"
				:placeholder="placeholder || $t('interfaces.tags.add_tags')"
				:aria-describedby="a11y?.describedBy"
				:aria-invalid="a11y?.invalid ? 'true' : undefined"
				disabled
				class="pe-11"
				:class="[FIELD_DISABLED, iconLeft ? 'ps-11' : '']"
			/>
			<span v-if="iconLeft" :class="ICON" class="start-4"><BoIcon :name="iconLeft" size="sm" /></span>
			<span class="absolute end-1.5 top-1/2 -translate-y-1/2">
				<button
					type="button"
					class="remove-variable"
					:class="ICON_BTN"
					:disabled="disabled"
					:aria-label="$t('clear_value')"
					:title="$t('clear_value')"
					@click.stop="clearVariable"
				>
					<BoIcon name="close" size="sm" />
				</button>
			</span>
		</div>

		<div v-else-if="allowCustom" class="relative">
			<BoTagsInput
				v-bind="tagsInputProps"
				:model-value="customVals"
				:disabled="!!(disabled || nonEditable)"
				:invalid="!!a11y?.invalid"
				class="[&_input]:pe-11"
				:class="iconLeft ? '[&_input]:ps-11' : ''"
				@update:model-value="onCustomUpdate"
			/>
			<span v-if="iconLeft" :class="ICON" class="start-4"><BoIcon :name="iconLeft" size="sm" /></span>
			<span :class="ICON" class="end-4"><BoIcon :name="iconRight" size="sm" /></span>
		</div>

		<div
			v-if="presetVals.length > 0"
			role="group"
			:aria-label="a11y && !isVariableMode && !allowCustom ? undefined : $t('presets')"
			:aria-labelledby="a11y && !isVariableMode && !allowCustom ? a11y.labelId : undefined"
			:aria-describedby="!isVariableMode && !allowCustom ? a11y?.describedBy : undefined"
			class="presets flex flex-wrap gap-1.5"
			:class="{ 'mt-2': isVariableMode || allowCustom }"
		>
			<button
				v-for="preset in presetVals"
				:key="preset"
				type="button"
				class="tag"
				:class="[selectedVals.includes(preset) ? PRESET_ON : PRESET_OFF, { inactive: !selectedVals.includes(preset) }]"
				:disabled="disabled || nonEditable"
				:aria-pressed="selectedVals.includes(preset) ? 'true' : 'false'"
				@click="toggleTag(preset)"
			>
				<BoIcon
					v-if="selectedVals.includes(preset)"
					name="check"
					size="sm"
					:style="{ fontSize: 'var(--text-theme-sm)' }"
				/>
				{{ preset }}
			</button>
		</div>
	</div>
</template>
