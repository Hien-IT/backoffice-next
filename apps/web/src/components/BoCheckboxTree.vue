<!-- Ported from directus/app/src/components/v-checkbox-tree/v-checkbox-tree.vue -->
<script setup lang="ts">
// Backoffice: one flat Reka Tree (roving focus, expand/collapse, role=tree) instead of nested VList groups; the
// per-node logic of VCheckboxTreeCheckbox.vue lives in checkbox-tree/value-combining.ts. The search input (more than
// 10 choices, 250 ms debounce) and the "show selected" toggle come from Directus select-multiple-checkbox-tree.vue, as
// the Tier 3 CheckboxTree recipe puts them in the component. Not ported: nonEditable, openGroups, group-toggle and the
// search highlight (v-highlight).
import { refDebounced } from '@vueuse/core';
import { deburr as removeDiacritics } from 'lodash-es';
import { TreeItem, TreeRoot } from 'reka-ui';
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';
import BoSwitch from './BoSwitch.vue';
import { getVisibleChildrenValues } from './checkbox-tree/use-visible-children.ts';
import { checkboxTreeNode, type ValueCombining } from './checkbox-tree/value-combining.ts';

type Value = string | number;

type TreeNode = {
	key: string;
	value: Value;
	text: string;
	disabled: boolean;
	/** Rendered as a group (has visible children); a group whose children are all filtered out renders as a leaf. */
	group: boolean;
	/** The `checked` prop Directus passes down (branch combining). */
	checked: boolean | null;
	/** Every child, visible or not: the value logic uses them all. */
	allChildren: Record<string, any>[];
	parent: TreeNode | null;
	children: TreeNode[];
};

const {
	choices = [],
	modelValue = null,
	valueCombining = 'all',
	itemText = 'text',
	itemValue = 'value',
	itemChildren = 'children',
	disabled = false,
	invalid = false,
	error,
	hint,
	label,
	id: idProp,
} = defineProps<{
	/** The choices that will be rendered as checkboxes */
	choices?: Record<string, any>[];
	/** Which choices should be shown as selected, depending on their value */
	modelValue?: Value[] | null;
	valueCombining?: ValueCombining;
	/** Which key in choices is used to display the text */
	itemText?: string;
	/** Which key in choices is used to model the active state */
	itemValue?: string;
	/** Which key in choices is used to render children */
	itemChildren?: string;
	/** Disables any interaction */
	disabled?: boolean;
	label?: string;
	invalid?: boolean;
	hint?: string;
	error?: string;
	id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: Value[]] }>();

const { t } = useI18n();

const id = idProp ?? useId();
const labelId = `${id}-label`;
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const value = computed(() => modelValue ?? []);

const search = ref('');
const searchDebounced = refDebounced(search, 250);
const showSelectionOnly = ref(false);

const normalizedSearch = computed(() =>
	searchDebounced.value ? removeDiacritics(searchDebounced.value).toLowerCase() : null,
);

const tree = computed(() => build(choices, null, null, '', ''));

function build(
	items: Record<string, any>[],
	parent: TreeNode | null,
	checked: boolean | null,
	parentValue: Value | null,
	ownValue: Value,
): TreeNode[] {
	const visible = visibleChildren(items, parentValue, ownValue);
	const nodes: TreeNode[] = [];

	for (const choice of items) {
		const nodeValue: Value = choice[itemValue];
		const allChildren: Record<string, any>[] = choice[itemChildren] ?? [];
		const hidden = visible.includes(nodeValue) === false;
		const hasVisibleChildren = visibleChildren(allChildren, parent?.value ?? null, nodeValue).length > 0;

		// VCheckboxTreeCheckbox: a group shows unless hidden (selected groups stay in "show selected"), a leaf unless hidden.
		const groupShown = (showSelectionOnly.value && value.value.includes(nodeValue)) || !hidden;
		if (hasVisibleChildren ? !groupShown : hidden) continue;

		const node: TreeNode = {
			key: String(nodeValue),
			value: nodeValue,
			text: choice[itemText],
			disabled: disabled || !!choice['disabled'] || !!parent?.disabled,
			group: hasVisibleChildren,
			checked,
			allChildren,
			parent,
			children: [],
		};

		if (hasVisibleChildren) {
			node.children = build(
				allChildren,
				node,
				nodeLogic(node).childrenCheckedStateOverride(),
				parent?.value ?? null,
				nodeValue,
			);
		}

		nodes.push(node);
	}

	return nodes;
}

function visibleChildren(items: Record<string, any>[], parentValue: Value | null, ownValue: Value) {
	return getVisibleChildrenValues(
		normalizedSearch.value,
		value.value,
		items,
		showSelectionOnly.value,
		itemText,
		itemValue,
		itemChildren,
		parentValue,
		ownValue,
	);
}

function nodeLogic(node: TreeNode) {
	return checkboxTreeNode({
		value: node.value,
		valueCombining,
		children: node.allChildren,
		modelValue: value.value,
		checked: node.checked,
		itemValue,
		itemChildren,
	});
}

// v-checkbox isChecked / indeterminate as each Directus node passes them.
function checkState(node: TreeNode): 'true' | 'false' | 'mixed' {
	const logic = nodeLogic(node);
	const checked = node.group ? logic.groupCheckedStateOverride() : node.checked;
	if (node.group && logic.groupIndeterminateState()) return 'mixed';
	return (checked ?? value.value.includes(node.value)) ? 'true' : 'false';
}

// v-checkbox toggleInput, then every treeValue setter from the node up to the root.
function toggleNode(node: TreeNode) {
	let newValue = value.value.includes(node.value)
		? value.value.filter((val) => val !== node.value)
		: [...value.value, node.value];

	for (let current: TreeNode | null = node; current; current = current.parent) {
		newValue = nodeLogic(current).setTreeValue(newValue);
	}

	emit('update:modelValue', newValue);
}

const manualOpenSelection = ref<string[]>([]);
let showAllSelection: string[] = [];

const searchOpenSelection = computed(() =>
	normalizedSearch.value ? searchChoices(normalizedSearch.value, choices).map(String) : [],
);

const openSelection = computed({
	get() {
		return Array.from(new Set([...manualOpenSelection.value, ...searchOpenSelection.value]));
	},
	set(newValue: string[]) {
		manualOpenSelection.value = newValue;
	},
});

watch(showSelectionOnly, (isSelectionOnly) => {
	if (isSelectionOnly) {
		const selection = new Set([...manualOpenSelection.value, ...findSelectedChoices(choices, value.value).map(String)]);

		showAllSelection = manualOpenSelection.value;
		manualOpenSelection.value = [...selection];
	} else {
		manualOpenSelection.value = [...showAllSelection];
	}
});

function searchChoices(text: string, target: Record<string, any>[], tree: Value[] = []) {
	const selection: Value[] = [];

	for (const item of target) {
		const normalizedItemText = removeDiacritics(item[itemText]).toLowerCase();

		if (normalizedItemText.includes(text)) {
			selection.push(...tree, item[itemValue]);
		}

		if (item[itemChildren]) {
			selection.push(...searchChoices(text, item[itemChildren], [...tree, item[itemValue]]));
		}
	}

	return selection;
}

function findSelectedChoices(choices: Record<string, any>[], checked: Value[]) {
	function selectedChoices(item: Record<string, any>): Value[] {
		if (!item[itemValue]) return [];
		const result: Value[] = [];

		const itemVal: Value = item[itemValue];
		if (checked.includes(itemVal)) result.push(itemVal);

		if (item[itemChildren]) {
			const children = item[itemChildren];

			if (Array.isArray(children) && children.length > 0) {
				const nestedResult = children.flatMap((child) => selectedChoices(child));

				if (nestedResult.length > 0) {
					result.push(...nestedResult, itemVal);
				}
			}
		}

		return result;
	}

	return choices.flatMap((item) => selectedChoices(item));
}

// Enter/Space and row clicks check; only the chevron and Right/Left expand.
function onSelect(event: Event, node: TreeNode) {
	event.preventDefault();
	if (!node.disabled) toggleNode(node);
}

function onToggle(event: CustomEvent<{ originalEvent: Event }>) {
	if (event.detail?.originalEvent?.type === 'click') event.preventDefault();
}

const ROW =
	'flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pe-2 text-sm text-gray-700 outline-hidden hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:focus-visible:outline-brand-400 aria-disabled:cursor-not-allowed aria-disabled:text-gray-300 dark:aria-disabled:text-gray-700';
// No bg-transparent here: it won over bg-brand-500 of the checked state and hid the white check (T093, axe).
const BOX = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.25px] text-white';
const BOX_STATE = {
	true: 'border-brand-500 bg-brand-500',
	mixed: 'border-brand-500 bg-brand-500',
	false: 'border-gray-500 dark:border-gray-500',
};
const CHEVRON =
	'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-transform hover:bg-gray-100 hover:text-gray-700 motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300';
const SEARCH =
	'mb-3 h-9 w-full rounded-lg border border-gray-500 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-500 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400';
const NOTE = 'px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400';
</script>

<template>
	<div>
		<span v-if="label" :id="labelId" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
			{{ label }}
		</span>
		<p v-if="choices.length === 0" :class="NOTE">{{ t('no_options_available') }}</p>
		<div
			v-else
			class="rounded-lg border p-2"
			:class="invalid || error ? 'border-error-600 dark:border-error-400' : 'border-gray-200 dark:border-gray-800'"
		>
			<template v-if="choices.length > 10">
				<label :for="`${id}-search`" class="sr-only">{{ t('search') }}</label>
				<input
					:id="`${id}-search`"
					v-model="search"
					type="search"
					:placeholder="t('search')"
					:disabled="disabled"
					:class="SEARCH"
				/>
			</template>
			<TreeRoot
				v-slot="{ flattenItems }"
				v-model:expanded="openSelection"
				:items="tree"
				:get-key="(node: TreeNode) => node.key"
				:get-children="(node: TreeNode) => (node.group ? node.children : undefined)"
				:aria-labelledby="label ? labelId : undefined"
				:aria-describedby="[hint ? hintId : '', error ? errorId : ''].join(' ').trim() || undefined"
				:aria-invalid="invalid || !!error ? 'true' : undefined"
				aria-multiselectable="true"
				class="list-none"
			>
				<TreeItem
					v-for="item in flattenItems"
					:key="item._id"
					v-slot="{ isExpanded, handleToggle }"
					v-bind="item.bind"
					:aria-checked="checkState(item.value)"
					:aria-disabled="item.value.disabled ? 'true' : undefined"
					:class="ROW"
					:style="{ paddingInlineStart: `${(item.level - 1) * 1.5}rem` }"
					@select="onSelect($event, item.value)"
					@toggle="onToggle"
				>
					<!-- Mouse only: Right/Left expand from the keyboard (aria-expanded on the treeitem). -->
					<span
						v-if="item.hasChildren"
						aria-hidden="true"
						:class="[CHEVRON, isExpanded ? 'rotate-90' : 'rtl:rotate-180']"
						@click.stop="handleToggle()"
					>
						<BoIcon name="chevron_right" size="sm" />
					</span>
					<span v-else class="w-6 shrink-0" />
					<span
						aria-hidden="true"
						:class="[
							BOX,
							item.value.disabled ? 'border-gray-200 dark:border-gray-800' : BOX_STATE[checkState(item.value)],
						]"
					>
						<BoIcon v-if="checkState(item.value) === 'true'" name="check" size="sm" />
						<BoIcon v-else-if="checkState(item.value) === 'mixed'" name="remove" size="sm" />
					</span>
					<span class="truncate">{{ item.value.text }}</span>
				</TreeItem>
			</TreeRoot>
			<p v-if="tree.length === 0" :class="NOTE">{{ t('no_results') }}</p>
			<BoSwitch
				v-model="showSelectionOnly"
				class="mt-3"
				:label="t('interfaces.select-multiple-checkbox-tree.show_selected')"
				:disabled="disabled || value.length === 0"
			/>
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
