<!-- Ported from directus/app/src/interfaces/_system/system-filter/Nodes.vue -->
<script setup lang="ts">
// Backoffice: recipe "Search and advanced filter (Q-7)": rule rows and group rows with TailAdmin classes; the field
// button opens FieldList in a Reka popover, the operator a BoMenu (DR v-select inline). Drag and drop keeps the
// DR vuedraggable setup (`:list` changed in place, shared group `g1` so rules move between groups, `change` →
// emit). D-69: each row also has a menu with "Move up" / "Move down" (same array as a drag inside the list, WCAG
// 2.1.1, as BoSortableList), focus back on the row menu and a live region saying the new position. Icon buttons
// are labelled buttons (FR-027). "Wrap in group" of the recipe is not added (no DR equivalent). Owner 2026-10-23
// (D-170): while a row is dragged (`bo-filter-dragging` on body from start to end), every AND/OR group shows a faint
// dashed frame, an empty one 32px high, so the drop target is clear; the Sortable options stay those of DR.
// Spec 023 (D-187): a json path rule shows "Field › path (Type)", offers the operators of its type and, with
// `includeJsonPath`, opens JsonPathForm from its chip to change the path or the type; field paths split at the dots
// outside parentheses (splitFieldPath), as a json path has its own.
import type {
	FieldFilter,
	FieldFilterOperator,
	FieldFunction,
	Filter,
	LogicalFilterAND,
	LogicalFilterOR,
	Type,
} from '@directus/types';
import { getFilterOperatorsForType, getOutputTypeForFunction, toArray } from '@directus/utils';
import { get } from 'lodash-es';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, nextTick, onUnmounted, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import Draggable from 'vuedraggable';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import FieldList from '../../../components/FieldList.vue';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import {
	formatJsonPathKey,
	jsonFilterType,
	parseJsonPathKey,
	type JsonPathKey,
	type JsonPathType,
} from '../../../utils/json-path.ts';
import InputGroup from './InputGroup.vue';
import JsonPathForm from './JsonPathForm.vue';
import {
	extractFieldFromFunction,
	fieldHasFunction,
	fieldToFilter,
	getComparator,
	getField,
	getNodeName,
	splitFieldPath,
} from './utils.ts';

type FilterInfo = {
	id: number;
	isField: false;
	name: string;
	node: Filter;
};

type FilterInfoField = {
	id: number;
	isField: true;
	name: string;
	node: Filter;
	field: string;
	comparator: string;
};

interface Props {
	filter: Filter[];
	collection: string;
	field?: string | undefined;
	depth?: number;
	inline?: boolean;
	includeValidation?: boolean;
	includeRelations?: boolean;
	relationalFieldSelectable?: boolean;
	rawFieldNames?: boolean;
	variableInputEnabled: boolean | undefined;
	/** Backoffice (spec 023): json path rules can change their path and type. */
	includeJsonPath?: boolean;
}

// Backoffice: a multi-word name (vue/multi-word-component-names); the template refers to itself by it.
defineOptions({ name: 'SystemFilterNodes' });

const props = withDefaults(defineProps<Props>(), {
	field: undefined,
	depth: 1,
	inline: false,
	includeValidation: false,
	includeRelations: true,
	relationalFieldSelectable: true,
	rawFieldNames: false,
	includeJsonPath: false,
});

const emit = defineEmits<{
	'remove-node': [ids: string[]];
	'update:filter': [filter: Filter[]];
	change: [];
}>();

const { collection } = toRefs(props);

// Backoffice: useSync of @directus/composables, inlined.
// D-170: a body class while a row is dragged, read by the group frames of every nesting level.
const DRAGGING = 'bo-filter-dragging';
const setDragging = (on: boolean) => document.body.classList.toggle(DRAGGING, on);
onUnmounted(() => setDragging(false));

const filterSync = computed<Filter[]>({
	get: () => props.filter,
	set: (value) => emit('update:filter', value),
});

const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();
const { t } = useI18n();

const filterInfo = computed<(FilterInfo | FilterInfoField)[]>({
	get() {
		return props.filter.map((node, id) => {
			const name = getNodeName(node);
			const isField = name.startsWith('_') === false;

			return isField
				? ({
						id,
						isField,
						name,
						field: getField(node),
						comparator: getComparator(node),
						node,
					} as FilterInfoField)
				: ({ id, name, isField, node } as FilterInfo);
		});
	},
	set(newVal) {
		emit(
			'update:filter',
			newVal.map((val) => val.node),
		);
	},
});

/** Backoffice (spec 023): the json path of a rule key, with the relational parts before it. */
function jsonPathOf(fieldKey: string): { parts: string[]; json: JsonPathKey } | null {
	const parts = splitFieldPath(fieldKey);
	const json = parseJsonPathKey(parts.at(-1)!);
	return json ? { parts: parts.slice(0, -1), json } : null;
}

function getFieldPreview(node: Record<string, any>) {
	const fieldKey = getField(node);
	const fieldParts = splitFieldPath(fieldKey);

	const fieldNames = fieldParts.map((fieldKey, index) => {
		const json = parseJsonPathKey(fieldKey);

		if (json) {
			const field = fieldsStore.getField(props.collection, [...fieldParts.slice(0, index), json.field].join('.'));
			const name = (props.rawFieldNames ? field?.field : field?.name) ?? json.field;
			return `${name} › ${json.path} (${t(`json_path_type_${json.type}`)})`;
		}

		const hasFunction = fieldHasFunction(fieldKey);

		let key = fieldKey;
		let functionName;

		if (hasFunction) {
			const { field, fn } = extractFieldFromFunction(fieldKey);
			functionName = fn;
			key = field;
		}

		const pathPrefix = fieldParts.slice(0, index);
		const field = fieldsStore.getField(props.collection, [...pathPrefix, key].join('.'));

		// Injected special fields, such as $version
		if (!field && key.startsWith('$')) {
			return t(key.replace('$', ''));
		}

		const name = (props.rawFieldNames ? field?.field : field?.name) ?? key;

		if (hasFunction) {
			return t(`functions.${functionName}`) + ` (${name})`;
		}

		return name;
	});

	return fieldNames.join(' -> ');
}

function getIndex(item: Filter) {
	return props.filter.findIndex((filter) => filter === item);
}

function toggleLogic(index: number) {
	const nodeInfo = filterInfo.value[index]!;

	if (filterInfo.value[index]!.isField) return;

	if ('_and' in nodeInfo.node) {
		filterSync.value = filterSync.value.map((filter, filterIndex) => {
			if (filterIndex === index) {
				return { _or: (nodeInfo.node as LogicalFilterAND)._and as FieldFilter[] };
			}

			return filter;
		});
	} else {
		filterSync.value = filterSync.value.map((filter, filterIndex) => {
			if (filterIndex === index) {
				return { _and: (nodeInfo.node as LogicalFilterOR)._or as FieldFilter[] };
			}

			return filter;
		});
	}
}

function updateComparator(index: number, operator: keyof FieldFilterOperator) {
	const nodeInfo = filterInfo.value[index]!;
	if (nodeInfo.isField === false) return;

	const value = get(nodeInfo.node, [...splitFieldPath(nodeInfo.field), nodeInfo.comparator]);

	switch (operator) {
		case '_in':
		case '_nin':
			update(toArray(value) || []);
			break;
		case '_between':
		case '_nbetween':
			update((toArray(value) || []).slice(0, 2));
			break;
		case '_null':
		case '_nnull':
		case '_empty':
		case '_nempty':
			update(true);
			break;
		case '_intersects':
		case '_nintersects':
		case '_intersects_bbox':
		case '_nintersects_bbox':
			if (['_intersects', '_nintersects', '_intersects_bbox', '_nintersects_bbox'].includes(nodeInfo.comparator)) {
				update(value);
			} else {
				update(null);
			}

			break;
		default:
			// avoid setting value as string 'true'/'false' when switching from null/empty operators
			if (['_null', '_nnull', '_empty', '_nempty'].includes(nodeInfo.comparator)) {
				update(null);
			} else {
				update(Array.isArray(value) ? value[0] : value);
			}

			break;
	}

	function update(value: any) {
		if (nodeInfo.isField === false) return;

		filterSync.value = filterSync.value.map((filter, filterIndex) => {
			if (filterIndex === index) return fieldToFilter(nodeInfo.field, operator, value);
			return filter;
		});
	}
}

function updateField(index: number, newField: string) {
	const nodeInfo = filterInfo.value[index]!;
	const oldFieldInfo = fieldsStore.getField(props.collection, nodeInfo.name);
	const newFieldInfo = fieldsStore.getField(props.collection, newField);

	if (nodeInfo.isField === false) return;

	let value = get(nodeInfo.node, [...splitFieldPath(nodeInfo.field), nodeInfo.comparator]);
	let comparator = nodeInfo.comparator;

	if (oldFieldInfo?.type !== newFieldInfo?.type) {
		value = null;
		comparator = getCompareOptions(newField)[0]!.value;
	}

	filterSync.value = filterSync.value.map((filter, filterIndex) => {
		if (filterIndex === index) return fieldToFilter(newField, comparator, value);
		return filter;
	});
}

/** Backoffice (spec 023): a new path or type for a json path rule; another type resets the operator and the value. */
function updateJsonPath(index: number, { path, type }: { path: string; type: JsonPathType }) {
	jsonEditOpen.value = null;

	const nodeInfo = filterInfo.value[index]!;
	if (nodeInfo.isField === false) return;

	const current = jsonPathOf(nodeInfo.field);
	if (!current) return;

	const newField = [...current.parts, formatJsonPathKey(current.json.field, path, type)].join('.');
	let comparator = nodeInfo.comparator;
	let value = get(nodeInfo.node, [...splitFieldPath(nodeInfo.field), nodeInfo.comparator]);

	if (type !== current.json.type) {
		comparator = getCompareOptions(newField)[0]!.value;
		value = ['_null', '_nnull', '_empty', '_nempty'].includes(comparator) ? true : null;
	}

	replaceNode(index, fieldToFilter(newField, comparator, value) as Filter);
}

const jsonEditOpen = ref<number | null>(null);

function replaceNode(index: number, newFilter: Filter) {
	filterSync.value = filterSync.value.map((val, filterIndex) => {
		if (filterIndex === index) return newFilter;
		return val;
	});
}

function getCompareOptions(name: string) {
	let type: Type;

	const json = jsonPathOf(name);

	if (name === '$version') {
		type = 'string';
	} else if (json) {
		type = jsonFilterType(json.json.type);
	} else if (fieldHasFunction(name)) {
		const functionName = name.split('(')[0] as FieldFunction;
		type = getOutputTypeForFunction(functionName);
	} else {
		const fieldInfo = fieldsStore.getField(props.collection, name);
		type = fieldInfo?.type || 'unknown';

		// Alias uses the foreign key type
		if (type === 'alias') {
			const relations = relationsStore.getRelationsForField(props.collection, name);

			if (relations[0]) {
				type = fieldsStore.getField(relations[0].collection, relations[0].field!)?.type || 'unknown';
			}
		}
	}

	return getFilterOperatorsForType(type, { includeValidation: props.includeValidation }).map((type) => ({
		text: t(`operators.${type}`),
		value: `_${type}`,
	}));
}

function isExistingField(node: Record<string, any>): boolean {
	if (!props.collection) return false;
	let fieldKey = getField(node);

	if (fieldHasFunction(fieldKey)) {
		const keyParts = splitFieldPath(fieldKey);
		// the function is always in the last key part
		const json = parseJsonPathKey(keyParts.at(-1)!);
		const field = json ? json.field : extractFieldFromFunction(keyParts.at(-1)!).field;
		fieldKey = [...keyParts.slice(0, -1), field].join('.');
	}

	const field = fieldsStore.getField(props.collection, fieldKey);
	return !!field;
}

// --- Backoffice: operator menu (DR v-select inline) ---
function comparatorItems(index: number): BoMenuItem[] {
	const info = filterInfo.value[index] as FilterInfoField;

	return getCompareOptions(info.field).map((option) => ({
		text: option.text,
		icon: option.value === info.comparator ? 'check' : undefined,
		onSelect: () => updateComparator(index, option.value as keyof FieldFilterOperator),
	}));
}

function comparatorText(index: number) {
	const info = filterInfo.value[index] as FilterInfoField;
	return t(`operators.${info.comparator.slice(1)}`);
}

// --- Backoffice: D-69 keyboard path for drag and drop ---
const root = ref<HTMLElement>();
const announcement = ref('');

function rowLabel(index: number) {
	const info = filterInfo.value[index]!;
	if (info.isField) return getFieldPreview(info.node);
	return t(info.name === '_and' ? 'interfaces.filter.logic_type_and' : 'interfaces.filter.logic_type_or');
}

function moveItems(index: number): BoMenuItem[] {
	const last = props.filter.length - 1;

	return [
		{ text: t('move_up'), icon: 'arrow_upward', disabled: index === 0, onSelect: () => move(index, index - 1) },
		{ text: t('move_down'), icon: 'arrow_downward', disabled: index === last, onSelect: () => move(index, index + 1) },
	];
}

async function move(from: number, to: number) {
	const label = rowLabel(from);
	const next = [...props.filter];
	const [item] = next.splice(from, 1) as [Filter];
	next.splice(to, 0, item);

	filterSync.value = next;
	announcement.value = t('moved_to_position', { item: label, position: to + 1, total: next.length });

	// Rows are keyed by index (as DR), so Reka gives focus back to the trigger at the old index when the menu
	// closes: that focus is sent on to the moved row's trigger (onFocusin).
	focusTo.value = to;
	await nextTick();
	rowMenu(to)?.focus();
	setTimeout(() => (focusTo.value = null), 500);
}

const focusTo = ref<number | null>(null);

function rowMenu(index: number) {
	return root.value?.querySelectorAll<HTMLElement>(':scope > ul > li > div > .rule-header .row-menu')[index];
}

function onFocusin(event: FocusEvent) {
	if (focusTo.value === null || !(event.target as HTMLElement).classList.contains('row-menu')) return;
	const target = rowMenu(focusTo.value);
	if (target && event.target !== target) target.focus();
}

// The DR `.header` pill: input background and a subdued border, as wide as its content.
// Owner 2026-10-23 (D-171): an AND/OR group is a TailAdmin card holding its header row (flat, the card is its frame)
// and its rows, with a 3px start border in the color of its logic chip (brand AND, orange OR); while a row is dragged
// (D-170) the card border turns dashed brand on a light brand tint and an empty group keeps 32px to drop into.
const GROUP_CARD =
	'rounded-xl border border-s-[3px] border-gray-200 bg-gray-50 p-3 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] in-[.bo-filter-dragging]:border-dashed in-[.bo-filter-dragging]:border-brand-300 in-[.bo-filter-dragging]:bg-brand-500/5 dark:in-[.bo-filter-dragging]:border-brand-500/40';
const GROUP_ACCENT = {
	_and: 'border-s-brand-400 dark:border-s-brand-500',
	_or: 'border-s-orange-400 dark:border-s-orange-500',
};
const GROUP_HEADER =
	'rule-header flex w-full flex-wrap items-center gap-1 text-theme-sm text-gray-800 dark:text-white/90';
const HEADER =
	'rule-header flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 ps-1.5 pe-1 text-theme-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';
const CHIP_BTN =
	'inline-flex items-center rounded-md px-1.5 py-0.5 text-start whitespace-nowrap hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400';
const ICON_BTN =
	'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-700 dark:bg-gray-800';
</script>

<template>
	<div ref="root" @focusin="onFocusin">
		<Draggable
			tag="ul"
			draggable=".row"
			handle=".drag-handle"
			class="group min-h-2 space-y-1"
			:class="{ 'mt-2 ps-4 in-[.bo-filter-dragging]:min-h-8': depth > 1 }"
			:list="filterSync"
			:group="{ name: 'g1' }"
			:item-key="getIndex"
			:swap-threshold="0.3"
			ghost-class="opacity-50"
			v-bind="{ 'force-fallback': true }"
			@change="$emit('change')"
			@start="setDragging(true)"
			@end="setDragging(false)"
		>
			<template #item="{ element, index }">
				<li class="row">
					<div v-if="filterInfo[index]!.isField" class="node field">
						<div :class="[HEADER, { 'font-mono': rawFieldNames }]">
							<BoIcon
								name="drag_indicator"
								size="sm"
								class="drag-handle cursor-grab text-gray-500 dark:text-gray-400"
							/>
							<PopoverRoot
								v-if="includeJsonPath && jsonPathOf(getField(element)) && isExistingField(element)"
								:open="jsonEditOpen === index"
								@update:open="jsonEditOpen = $event ? index : null"
							>
								<PopoverTrigger class="field-button json-path-button" :class="CHIP_BTN">
									{{ getFieldPreview(element) }}
								</PopoverTrigger>
								<PopoverPortal>
									<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
										<JsonPathForm
											:title="getFieldPreview(element).split(' › ')[0]!"
											:path="jsonPathOf(getField(element))!.json.path"
											:type="jsonPathOf(getField(element))!.json.type"
											@apply="updateJsonPath(index, $event)"
										/>
									</PopoverContent>
								</PopoverPortal>
							</PopoverRoot>
							<span
								v-else-if="field || !isExistingField(element) || jsonPathOf(getField(element))"
								class="whitespace-nowrap"
							>
								{{ getFieldPreview(element) }}
							</span>
							<PopoverRoot v-else>
								<PopoverTrigger class="field-button" :class="CHIP_BTN">
									{{ getFieldPreview(element) }}
								</PopoverTrigger>
								<PopoverPortal>
									<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
										<FieldList
											:collection="collection"
											:field="field"
											include-functions
											:include-relations="includeRelations"
											:relational-field-selectable="relationalFieldSelectable"
											:allow-select-all="false"
											:raw-field-names="rawFieldNames"
											@add="updateField(index, $event[0]!)"
										/>
									</PopoverContent>
								</PopoverPortal>
							</PopoverRoot>
							<BoMenu :items="comparatorItems(index)">
								<template #trigger>
									<button
										type="button"
										class="comparator font-semibold text-gray-800 dark:text-white/90"
										:class="CHIP_BTN"
									>
										{{ comparatorText(index) }}
									</button>
								</template>
							</BoMenu>
							<InputGroup
								:field="element"
								:collection="collection"
								:variable-input-enabled="variableInputEnabled"
								@update:field="replaceNode(index, $event)"
							/>
							<span class="ms-auto inline-flex items-center">
								<BoMenu :items="moveItems(index)" align="end">
									<template #trigger>
										<button
											type="button"
											class="row-menu"
											:class="ICON_BTN"
											:aria-label="t('item_options', { item: rowLabel(index) })"
										>
											<BoIcon name="more_vert" size="sm" />
										</button>
									</template>
								</BoMenu>
								<button
									type="button"
									class="delete hover:text-error-500 dark:hover:text-error-400"
									:class="ICON_BTN"
									:aria-label="t('delete_label')"
									:title="t('delete_label')"
									@click="$emit('remove-node', [String(index)])"
								>
									<BoIcon name="close" size="sm" />
								</button>
							</span>
						</div>
					</div>

					<div v-else class="node logic" :class="[GROUP_CARD, GROUP_ACCENT[filterInfo[index]!.name as '_and' | '_or']]">
						<div :class="GROUP_HEADER">
							<BoIcon
								name="drag_indicator"
								size="sm"
								class="drag-handle cursor-grab text-gray-500 dark:text-gray-400"
							/>
							<button
								type="button"
								class="logic-key inline-flex items-center rounded-md px-1.5 py-0.5 text-theme-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
								:class="
									filterInfo[index]!.name === '_and'
										? 'bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400'
										: 'bg-orange-50 text-orange-500 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400'
								"
								@click="toggleLogic(index)"
							>
								{{
									filterInfo[index]!.name === '_and'
										? $t('interfaces.filter.logic_type_and')
										: $t('interfaces.filter.logic_type_or')
								}}
							</button>
							<span class="whitespace-nowrap text-gray-500 dark:text-gray-400">
								{{
									`— ${filterInfo[index]!.name === '_and' ? $t('interfaces.filter.all') : $t('interfaces.filter.any')} ${t(
										'interfaces.filter.of_the_following',
									)}`
								}}
							</span>
							<span class="ms-auto inline-flex items-center">
								<BoMenu :items="moveItems(index)" align="end">
									<template #trigger>
										<button
											type="button"
											class="row-menu"
											:class="ICON_BTN"
											:aria-label="t('item_options', { item: rowLabel(index) })"
										>
											<BoIcon name="more_vert" size="sm" />
										</button>
									</template>
								</BoMenu>
								<button
									type="button"
									class="delete hover:text-error-500 dark:hover:text-error-400"
									:class="ICON_BTN"
									:aria-label="t('delete_label')"
									:title="t('delete_label')"
									@click="$emit('remove-node', [String(index)])"
								>
									<BoIcon name="close" size="sm" />
								</button>
							</span>
						</div>
						<SystemFilterNodes
							:filter="element[filterInfo[index]!.name]"
							:collection="collection"
							:depth="depth + 1"
							:inline="inline"
							:raw-field-names="rawFieldNames"
							:variable-input-enabled="variableInputEnabled"
							:include-json-path="includeJsonPath"
							@change="$emit('change')"
							@remove-node="$emit('remove-node', [`${index}.${filterInfo[index]!.name}`, ...$event])"
							@update:filter="replaceNode(index, { [filterInfo[index]!.name]: $event } as Filter)"
						/>
					</div>
				</li>
			</template>
		</Draggable>
		<div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
	</div>
</template>
