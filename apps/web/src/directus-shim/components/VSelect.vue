<!-- Ported from directus/app/src/components/v-select/v-select.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps by mode. Single choice is BoSelect (extended with groups, dividers,
// item color and a `trigger` slot for `preview` and `inline`); its values are strings, so each item gets a string key
// mapped back to the DR value. `multiple` is BoMultiSelect (groups flattened, `showDeselect` = `allowNone`), a
// single `allowOther` is BoCombobox (the typed text is the value). Not honoured: `group-toggle` (groups are always
// open), the search row above 10 items in single mode (Reka typeahead instead), `closeOnContentClick: false`,
// `placement`, `attached`, `showArrow`, `itemLabelFontFamily`, `mandatory`; `preview`/`inline` and
// the count translations in multiple mode; `showDeselect` with a single `allowOther`. The menu is at most 30vh high
// unless `menuFullHeight` (v-select.vue:290).
import { get } from 'lodash-es';
import { computed, useAttrs } from 'vue';
import BoCombobox from '../../components/BoCombobox.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoMultiSelect from '../../components/BoMultiSelect.vue';
import BoSelect, { type BoSelectItem } from '../../components/BoSelect.vue';
import { FOCUS } from './list.ts';

type ItemsRaw = (string | any)[];
type InputValue = string[] | string | number | null;

const props = withDefaults(
	defineProps<{
		items: ItemsRaw;
		itemText?: string;
		itemValue?: string;
		itemIcon?: string | null;
		itemColor?: string | null;
		itemLabelFontFamily?: string;
		itemDisabled?: string;
		itemSelectable?: string;
		itemChildren?: string;
		modelValue?: InputValue;
		multiple?: boolean;
		groupSelectable?: boolean;
		mandatory?: boolean;
		placeholder?: string | null;
		fullWidth?: boolean;
		disabled?: boolean;
		nonEditable?: boolean;
		showDeselect?: boolean;
		allowOther?: boolean;
		closeOnContentClick?: boolean;
		inline?: boolean;
		attached?: boolean | undefined;
		showArrow?: boolean | undefined;
		label?: boolean;
		allItemsTranslation?: string;
		itemCountTranslation?: string;
		multiplePreviewThreshold?: number;
		placement?: string;
		menuFullHeight?: boolean;
	}>(),
	{
		itemText: 'text',
		itemValue: 'value',
		itemIcon: null,
		itemDisabled: 'disabled',
		itemSelectable: 'selectable',
		itemChildren: 'children',
		modelValue: null,
		mandatory: true,
		placeholder: null,
		fullWidth: true,
		closeOnContentClick: true,
		attached: undefined,
		showArrow: undefined,
		multiplePreviewThreshold: 3,
		placement: 'bottom',
	},
);

const emit = defineEmits(['update:modelValue', 'group-toggle']);

// An `id` names the field (a `<label for>` of the extension): it goes to the trigger, the rest to the root.
defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
const fieldId = computed(() => attrs['id'] as string | undefined);
const rootAttrs = computed(() => ({ ...attrs, id: undefined }));

type Parsed = {
	text: string;
	value: string | number;
	icon?: string | undefined;
	color?: string | null | undefined;
	disabled?: boolean;
};

/** DR useItems parseItem: the item keys read with `get`, a string item is its own text and value. */
function parse(item: any): Parsed & { selectable?: boolean; children?: any[] | null } {
	if (typeof item === 'string') return { text: item, value: item };

	return {
		text: get(item, props.itemText),
		value: get(item, props.itemValue),
		icon: props.itemIcon ? get(item, props.itemIcon) : undefined,
		color: props.itemColor ? get(item, props.itemColor) : undefined,
		disabled: !!get(item, props.itemDisabled),
		selectable: props.groupSelectable || !!get(item, props.itemSelectable),
		children: get(item, props.itemChildren) || null,
	};
}

const isDivider = (item: any) => typeof item === 'object' && item?.divider === true;

/** BoSelect items keyed by position, and the DR value of each key. */
const single = computed(() => {
	const values = new Map<string, unknown>();

	const toItem = (raw: any): BoSelectItem => {
		if (isDivider(raw)) return { text: '', value: '', divider: true };
		const { children, value, ...item } = parse(raw);
		const key = String(values.size);
		values.set(key, value);
		return { ...item, value: key, ...(children && { children: children.map(toItem) }) };
	};

	return { items: props.items.map(toItem), values };
});

const selectedKey = computed(
	() => [...single.value.values].find(([, value]) => value === props.modelValue)?.[0] ?? null,
);

/** Groups flattened for BoMultiSelect and BoCombobox: a divider before a group, its header only when selectable. */
const flat = computed(() => {
	const walk = (list: any[]): (Parsed | { divider: true })[] =>
		list.flatMap((raw) => {
			if (isDivider(raw)) return [{ divider: true as const }];
			const { children, selectable, ...item } = parse(raw);
			if (!children) return [item];
			return [{ divider: true as const }, ...(selectable ? [item] : []), ...walk(children)];
		});

	return walk(props.items);
});

const choices = computed(() => flat.value.filter((item): item is Parsed => !('divider' in item)));

// DR displayValue (single): the item text, else the value itself.
const displayText = computed(() => {
	if (props.modelValue === null || props.modelValue === undefined) return '';
	return String(choices.value.find((item) => item.value === props.modelValue)?.text || props.modelValue);
});

// allowOther (BoCombobox): one value, never a list.
const otherValue = computed(() => (Array.isArray(props.modelValue) ? null : props.modelValue));

function onSingle(key: string) {
	emit('update:modelValue', single.value.values.get(key));
}

const INLINE =
	'inline-flex max-w-full items-center gap-1 rounded-lg text-start text-theme-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300';
const LABEL =
	'bg-gray-100 px-2 py-1 text-gray-600 hover:text-gray-800 dark:bg-white/5 dark:text-gray-400 dark:hover:text-gray-300';
</script>

<template>
	<div v-bind="rootAttrs" class="v-select" :class="fullWidth && !inline ? 'w-full' : 'inline-block'">
		<BoMultiSelect
			v-if="multiple"
			:id="fieldId"
			:short-menu="!menuFullHeight"
			:model-value="Array.isArray(modelValue) ? modelValue : null"
			:items="flat"
			:preview-threshold="multiplePreviewThreshold"
			:allow-other="!!allowOther"
			:allow-none="!!showDeselect"
			:placeholder="placeholder ?? ''"
			:disabled="!!disabled"
			:non-editable="!!nonEditable"
			@update:model-value="emit('update:modelValue', $event?.length ? $event : null)"
		>
			<template v-if="$slots['prepend']" #prepend><slot name="prepend" /></template>
		</BoMultiSelect>

		<BoCombobox
			v-else-if="allowOther"
			:id="fieldId"
			:short-menu="!menuFullHeight"
			:model-value="otherValue"
			:items="choices"
			allow-other
			item-icon="icon"
			item-color="color"
			:placeholder="placeholder ?? ''"
			:disabled="!!(disabled || nonEditable)"
			@update:model-value="emit('update:modelValue', $event)"
		>
			<template v-if="$slots['prepend']" #prepend><slot name="prepend" /></template>
			<template v-if="$slots['append']" #append><slot name="append" /></template>
		</BoCombobox>

		<BoSelect
			v-else
			:id="fieldId"
			:short-menu="!menuFullHeight"
			:model-value="selectedKey"
			:items="single.items"
			:show-deselect="!!showDeselect && !nonEditable"
			:placeholder="(selectedKey === null && displayText) || placeholder || ''"
			:disabled="!!disabled"
			@update:model-value="onSingle"
			@deselect="emit('update:modelValue', null)"
		>
			<template v-if="inline || $slots['preview']" #trigger="{ open, toggle }">
				<button
					v-if="inline"
					type="button"
					aria-haspopup="listbox"
					:aria-expanded="open"
					:disabled="!!disabled"
					:class="[INLINE, FOCUS, { [LABEL]: label }]"
					@click="toggle"
				>
					<slot name="preview">
						<span class="truncate" :class="{ 'text-gray-500 dark:text-gray-400': !displayText }">
							{{ displayText || placeholder }}
						</span>
					</slot>
					<BoIcon name="expand_more" size="sm" :class="{ 'rotate-180': open }" />
				</button>
				<slot v-else name="preview" :active="open" :toggle="toggle" />
			</template>
			<template v-if="$slots['prepend']" #prepend><slot name="prepend" /></template>
			<template v-if="$slots['append']" #append><slot name="append" /></template>
		</BoSelect>
	</div>
</template>
