<!-- Ported from directus/app/src/interfaces/_system/system-filter/input-component.vue -->
<script setup lang="ts">
// Backoffice: recipe "Search and advanced filter (Q-7)": compact value controls. The text input keeps the DR
// rules (pattern by type, dynamic variables such as `$NOW(-7 days)`, `$CURRENT_USER`, comma handling) and grows with
// its text through `size` (no v-input-auto-width directive). Choices open a BoMenu (DR v-select inline;
// `allow-other` is left out: a value outside the choices is typed after switching the operator). Dates open BoDatePicker
// in a Reka popover; the other types (json, text, hash, geometry) open the 013 interface of the same id from the
// registry in a popover, as DR renders `<component :is="interface-…">` in a v-menu.
import { isDynamicVariable } from '@directus/utils';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, onMounted, onUpdated, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoDatePicker from '../../../components/BoDatePicker.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import { getInterface } from '../../index.ts';

type Choice = {
	text: string;
	value: string | number;
	children?: Choice[];
};

type Value = string | number | Record<string, unknown> | boolean | null;

const props = withDefaults(
	defineProps<{
		is: string;
		type: string;
		value: Value;
		commaAllowed?: boolean;
		focus?: boolean;
		choices?: Choice[];
	}>(),
	{
		focus: true,
		choices: () => [],
	},
);

const emit = defineEmits<{
	input: [value: Value];
	commaKeyPressed: [];
	commaValuePasted: [value: string];
}>();

const { t } = useI18n();

const dateTimeMenu = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);
const isInputValid = ref(true);

// Backoffice: width of the text input in characters (DR v-input-auto-width).
const text = ref('');

const displayValue = computed(() => {
	if (props.value === null) return null;
	if (props.value === undefined) return null;

	if (typeof props.value === 'string' && props.value.length > 25) {
		return props.value.substring(0, 22) + '...';
	}

	return props.value;
});

const inputPattern = computed(() => {
	switch (props.type) {
		case 'integer':
		case 'bigInteger':
			return '^[+\\-]?[0-9]+$';
		case 'decimal':
		case 'float':
			return '^[+\\-]?[0-9]+\\.?[0-9]*$';
		case 'uuid':
			return '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$';
		default:
			return undefined;
	}
});

onMounted(() => {
	if (props.focus) inputEl.value?.focus();
});

/*
 * Because there's currently (2024-01-09) no way to uniquely identify filters
 * we run into rendering issues when dragging and reordering input-groups/input-components.
 * By listening for the DOM changes via `onUpdated` we can keep this component updated
 * without having a `key` for each input-group in nodes.
 */
onUpdated(() => onEffect(props.value));

watch(
	() => props.value,
	(value) => {
		onEffect(value);
		text.value = value === null || value === undefined ? '' : String(value);
	},
	{ immediate: true },
);

function isValueValid(value: any): boolean {
	if (
		value === '' ||
		typeof value !== 'string' ||
		(props.commaAllowed && value.includes(',')) ||
		!inputPattern.value ||
		new RegExp(inputPattern.value).test(value)
	) {
		return true;
	}

	if (isDynamicVariable(value) || /^{{\s*?\S+?\s*?}}$/.test(value)) {
		return true;
	}

	return false;
}

function onEffect(value: typeof props.value) {
	isInputValid.value = isValueValid(value);
}

function onInput(value: Value) {
	isInputValid.value = isValueValid(value);

	if (isInputValid.value) emit('input', value === '' ? null : value);
}

function onTextInput(event: Event) {
	text.value = (event.target as HTMLInputElement).value;
	onInput(text.value);
}

function onKeyDown(event: KeyboardEvent) {
	if (event.key === ',' && props.commaAllowed) {
		event.preventDefault();
		emit('commaKeyPressed');
	}
}

function onPaste(event: ClipboardEvent) {
	if (!props.commaAllowed) return;

	const clipboardData = event.clipboardData?.getData('text') || '';

	if (clipboardData.includes(',')) {
		event.preventDefault();
		emit('commaValuePasted', clipboardData);
	}
}

// Backoffice: v-select `group-selectable` lists a group and its children; the menu is flat, children indented by text.
const choiceItems = computed<BoMenuItem[]>(() => {
	const items: BoMenuItem[] = [];
	addChoices(props.choices, 0);
	return items;

	function addChoices(choices: Choice[], depth: number) {
		for (const choice of choices) {
			items.push({ text: ' '.repeat(depth) + choice.text, onSelect: () => onInput(choice.value) });
			if (choice.children) addChoices(choice.children, depth + 1);
		}
	}
});

const choiceText = computed(() => {
	const found = findChoice(props.choices);
	return found?.text ?? (props.value === null || props.value === undefined ? null : String(props.value));

	function findChoice(choices: Choice[]): Choice | undefined {
		for (const choice of choices) {
			if (choice.value === props.value) return choice;
			const child = choice.children && findChoice(choice.children);
			if (child) return child;
		}

		return undefined;
	}
});

const pickerType = computed(() => props.type as 'date' | 'time' | 'dateTime' | 'timestamp');
const pickerValue = computed(() => props.value as string | null);

const interfaceComponent = computed(() => getInterface(props.is.replace(/^interface-/, ''))?.component);

defineExpose({
	focus() {
		inputEl.value?.focus();
	},
});

const PREVIEW =
	'inline-flex max-w-[40ch] cursor-pointer items-center truncate rounded font-mono text-theme-sm text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:focus-visible:outline-brand-400';
const INPUT =
	'max-w-[40ch] border-0 border-b bg-transparent p-0 font-mono text-theme-sm text-brand-500 placeholder:text-gray-400 focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:placeholder:text-gray-500 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<button
		v-if="type === 'boolean'"
		type="button"
		role="checkbox"
		:aria-checked="value === null ? 'mixed' : !!value"
		:aria-label="t('value')"
		:class="PREVIEW"
		@click="$emit('input', !value)"
	>
		<BoIcon
			:name="value === null ? 'indeterminate_check_box' : value ? 'check_box' : 'check_box_outline_blank'"
			size="sm"
		/>
	</button>
	<input
		v-else-if="is === 'interface-input'"
		ref="inputEl"
		type="text"
		:size="Math.max(text.length, 2)"
		:pattern="inputPattern"
		:value="value"
		placeholder="--"
		:aria-label="t('value')"
		:aria-invalid="isInputValid ? undefined : 'true'"
		:class="[INPUT, isInputValid ? 'border-transparent' : 'border-error-500']"
		@input="onTextInput"
		@keydown="onKeyDown"
		@paste="onPaste"
	/>
	<BoMenu v-else-if="is === 'select'" :items="choiceItems">
		<template #trigger>
			<button type="button" :class="[PREVIEW, { 'text-gray-400 dark:text-gray-500': choiceText === null }]">
				{{ choiceText ?? t('select') }}
			</button>
		</template>
	</BoMenu>
	<span v-else-if="is === 'interface-datetime'" class="inline-flex items-center gap-1">
		<input
			ref="inputEl"
			type="text"
			:size="Math.max(text.length, 2)"
			:value="value"
			placeholder="--"
			:aria-label="t('value')"
			:class="[INPUT, 'border-transparent']"
			@input="onTextInput"
		/>
		<PopoverRoot v-model:open="dateTimeMenu">
			<PopoverTrigger :class="PREVIEW" :aria-label="t('interfaces.filter.change_value')">
				<BoIcon name="event" size="sm" />
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
					<BoDatePicker
						:type="pickerType"
						:model-value="pickerValue"
						@update:model-value="onInput"
						@close="dateTimeMenu = false"
					/>
				</PopoverContent>
			</PopoverPortal>
		</PopoverRoot>
	</span>
	<PopoverRoot v-else>
		<PopoverTrigger :class="PREVIEW" :aria-label="t('interfaces.filter.change_value')">
			<BoIcon
				v-if="type.startsWith('geometry') || type === 'json'"
				:name="type === 'json' ? 'integration_instructions' : 'map'"
				size="sm"
			/>
			<template v-else>{{ displayValue ?? '--' }}</template>
		</PopoverTrigger>
		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				:collision-padding="8"
				:class="[POPOVER, type.startsWith('geometry') || type === 'json' ? 'w-[28rem]' : 'w-80']"
			>
				<component :is="interfaceComponent" v-if="interfaceComponent" :type="type" :value="value" @input="onInput" />
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
