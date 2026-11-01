<!-- Ported from directus/app/src/interfaces/_system/system-filter/input-group.vue -->
<script setup lang="ts">
// Backoffice: icon buttons are buttons with labels (FR-027); `{{ }}` braces of the variable input are text around a
// compact input.
import type { Field, FieldFilter } from '@directus/types';
import { clone, get } from 'lodash-es';
import { computed, nextTick, onBeforeMount, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import { useCollection } from '../../../composables/use-collection.ts';
import { useFakeVersionField } from '../../../composables/use-fake-version-field.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import {
	fieldCompareGroup,
	formatFieldCompare,
	isFieldCompareOperator,
	parseFieldCompare,
} from '../../../utils/field-compare.ts';
import { jsonFilterType, parseJsonPathKey } from '../../../utils/json-path.ts';
import InputComponent from './InputComponent.vue';
import { fieldToFilter, getComparator, getField, splitFieldPath } from './utils.ts';

// Workaround because you cannot cast directly to union types inside
// the template block without running into eslint/prettier issues
type ScalarValue = string | boolean | number | null;

const props = defineProps<{
	field: FieldFilter;
	collection: string;
	variableInputEnabled?: boolean | undefined;
	rawFieldNames?: boolean;
	/** Backoffice (spec 028, D-206): the value control offers a field of the same type group (`$FIELD(b)`). */
	includeFieldCompare?: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:field', value: FieldFilter): void;
}>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const fieldPath = computed(() => getField(props.field));
const isVersionField = computed(() => fieldPath.value === '$version');

const { info: collectionInfo } = useCollection(computed(() => props.collection));
const versioningEnabled = computed(() => !!collectionInfo.value?.meta?.versioning && isVersionField.value);
const { fakeVersionField } = useFakeVersionField(toRef(props, 'collection'), versioningEnabled, isVersionField);

const fieldInfo = computed(() => {
	if (isVersionField.value) {
		return fakeVersionField.value;
	}

	// Backoffice (spec 023): a json path rule takes the input of the type chosen for the value at the path.
	const json = parseJsonPathKey(splitFieldPath(fieldPath.value).at(-1)!);

	if (json) {
		return {
			collection: props.collection,
			field: fieldPath.value,
			name: json.path,
			type: jsonFilterType(json.type),
			meta: null,
			schema: null,
		} as unknown as ReturnType<typeof fieldsStore.getField>;
	}

	const fieldInfo = fieldsStore.getField(props.collection, fieldPath.value);

	// Alias uses the foreign key type
	if (fieldInfo?.type === 'alias') {
		const relations = relationsStore.getRelationsForField(props.collection, fieldPath.value);

		if (relations[0]) {
			return fieldsStore.getField(relations[0].collection, relations[0].field!);
		}
	}

	return fieldInfo;
});

const comparator = computed(() => {
	return getComparator(props.field);
});

const interfaceType = computed(() => {
	if (fieldInfo.value?.meta?.options?.['choices']) return 'select';

	const types: Record<string, string> = {
		bigInteger: 'input',
		binary: 'input',
		boolean: 'boolean',
		date: 'datetime',
		dateTime: 'datetime',
		decimal: 'input',
		float: 'input',
		integer: 'input',
		json: 'input-code',
		string: 'input',
		text: 'input-multiline',
		time: 'datetime',
		timestamp: 'datetime',
		uuid: 'input',
		csv: 'input',
		hash: 'input-hash',
		geometry: 'map',
	};

	return 'interface-' + types[fieldInfo.value?.type || 'string'];
});

const fieldValue = computed(() => {
	return get(props.field, [...splitFieldPath(fieldPath.value), comparator.value]);
});

const {
	isVariableInputActive,
	isVariableInputComparator,
	variableInputDisplay,
	onToggleVariableInput,
	onVariableInput,
} = useVariableInput();

const value = computed<unknown | unknown[]>({
	get() {
		if (!isVariableInputActive.value && ['_in', '_nin'].includes(comparator.value)) {
			return [...(fieldValue.value as (string | number | null)[]).filter((val) => val !== null && val !== ''), null];
		}

		return fieldValue.value;
	},
	set(newVal) {
		let value;

		if (!isVariableInputActive.value && ['_in', '_nin'].includes(comparator.value)) {
			value = (newVal as (string | number | null)[])
				.filter((val) => val !== null && val !== '')
				.map((val) => (typeof val === 'string' ? val.trim() : val));
		} else {
			value = newVal;
		}

		emit('update:field', fieldToFilter(fieldPath.value, comparator.value, value) as FieldFilter);
	},
});

const choices = computed(() => fieldInfo.value?.meta?.options?.['choices'] ?? []);

// Backoffice (spec 028, D-206): with `includeFieldCompare`, the six comparison operators take a field of the same
// collection and type group as their value (`$FIELD(b)`), picked from a menu; the value shows as a chip with the name
// of field b (its key when it no longer exists, in the error colour). A typed `$FIELD(b)` is read the same way.
const fieldKey = computed(() => splitFieldPath(fieldPath.value).at(-1)!);
const compareGroup = computed(() => fieldCompareGroup(fieldInfo.value?.type));

const canCompareField = computed(
	() =>
		!!props.includeFieldCompare &&
		!isVersionField.value &&
		parseJsonPathKey(fieldKey.value) === null &&
		isFieldCompareOperator(comparator.value) &&
		compareGroup.value !== null,
);

const compareCollection = computed(() => fieldInfo.value?.collection ?? props.collection);

const compareFields = computed(() =>
	fieldsStore
		.getFieldsForCollection(compareCollection.value)
		.filter((field) => field.field !== fieldKey.value && fieldCompareGroup(field.type) === compareGroup.value),
);

/** The display name, with the key when another listed field has the same name (clarify 2026-11-01 Q5). */
function fieldLabel(field: Field): string {
	if (props.rawFieldNames) return field.field;
	const twins = compareFields.value.filter((other) => other.name === field.name && other.field !== field.field);
	return twins.length > 0 ? `${field.name} (${field.field})` : field.name;
}

const compareWith = computed(() => parseFieldCompare(fieldValue.value));

const compareWithField = computed(() =>
	compareWith.value === null ? null : fieldsStore.getField(compareCollection.value, compareWith.value),
);

const compareMissing = computed(() => compareWith.value !== null && compareWithField.value === null);
const compareLabel = computed(() =>
	compareWithField.value ? fieldLabel(compareWithField.value) : (compareWith.value ?? ''),
);
const chipEl = ref<HTMLButtonElement | null>(null);

const compareItems = computed<BoMenuItem[]>(() => [
	{ text: t('field_compare_value'), icon: 'edit', onSelect: () => (value.value = null) },
	...compareFields.value.map((field) => ({
		text: fieldLabel(field),
		onSelect: () => {
			value.value = formatFieldCompare(field.field);
			nextTick(() => chipEl.value?.focus());
		},
	})),
]);
const inputRefs = ref<any[]>([]);

function setValueAt(index: number, newVal: any) {
	const newArray = Array.isArray(value.value) ? clone(value.value) : new Array(index + 1);
	newArray[index] = newVal;
	value.value = newArray;
}

function focusInputAtIndex(index: number) {
	nextTick(() => {
		if (inputRefs.value.length > index && inputRefs.value[index]) {
			inputRefs.value[index].focus();
		}
	});
}

function handleCommaKeyPressed(index: number) {
	if (Array.isArray(value.value) && value.value.length > index + 1) {
		focusInputAtIndex(index + 1);
	}
}

function handleCommaValuePasted(newValue: string) {
	const newValueArray = [
		...(value.value as (string | number)[]),
		...newValue.split(',').filter((val) => val !== null && val !== ''),
	];

	value.value = newValueArray;
	focusInputAtIndex(newValueArray.length - 1);
}

function useVariableInput() {
	const arrayComparators = ['_in', '_nin', '_between', '_nbetween'];
	const variableInputComparators = ['_in', '_nin'];
	const isVariableInputActive = ref(false);
	const variableInputDisplay = computed(inputDisplay);
	const isArrayComparator = computed(() => props.variableInputEnabled && arrayComparators.includes(comparator.value));

	const isVariableInputComparator = computed(
		() => props.variableInputEnabled && variableInputComparators.includes(comparator.value),
	);

	onBeforeMount(determineVariableInput);

	return {
		isVariableInputActive,
		isVariableInputComparator,
		onToggleVariableInput,
		onVariableInput,
		variableInputDisplay,
	};

	function determineVariableInput() {
		if (!isVariableInputComparator.value) return;
		isVariableInputActive.value = !Array.isArray(fieldValue.value);
	}

	function onToggleVariableInput() {
		const showVariableInput = !isVariableInputActive.value;

		if (showVariableInput) {
			// Note: first toggle, then set value

			isVariableInputActive.value = showVariableInput;

			if (isArrayComparator.value && Array.isArray(value.value)) {
				value.value = value.value.join(',');
			}
		} else {
			// Note: first set value, then toggle

			if (isArrayComparator.value) {
				if (typeof value.value === 'string') {
					value.value = (value.value as string).split(',');
				} else if (value.value === null) {
					value.value = [];
				} else {
					value.value = [value.value];
				}
			}

			isVariableInputActive.value = showVariableInput;
		}
	}

	function onVariableInput(newValue: unknown) {
		if (newValue === null) {
			value.value = '';
			return;
		}

		newValue = String(newValue).replace(/{{/g, '').replace(/}}/g, '');
		value.value = `{{${newValue}}}`;
	}

	function inputDisplay() {
		if (isVariableInputActive.value && typeof value.value === 'string') {
			return value.value.replace(/{{/g, '').replace(/}}/g, '');
		}

		return '';
	}
}

// Spec 028: the chip of a compared field (as the field chip of the rule) and the picker button (as the `{{ }}` one).
const CHIP =
	'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-theme-sm whitespace-nowrap hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400';
const PICKER =
	'inline-flex size-6 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400';

// DR `.list .value:not(:last-child)::after { content: ',' }`.
const COMMA = "after:me-1 after:text-gray-500 after:content-[','] dark:after:text-gray-400";
const BRACES = 'font-mono text-theme-sm text-gray-500 dark:text-gray-400';
</script>

<template>
	<button
		v-if="isVariableInputComparator"
		type="button"
		:aria-label="t('toggle_variable_input')"
		:title="t('toggle_variable_input')"
		:aria-pressed="isVariableInputActive"
		class="inline-flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		:class="
			isVariableInputActive
				? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
				: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
		"
		@click="onToggleVariableInput"
	>
		<BoIcon name="data_object" size="sm" />
	</button>

	<template v-if="isVariableInputActive">
		<span :class="BRACES">{{ '\{\{' }}</span>
		<InputComponent is="interface-input" type="unknown" :value="variableInputDisplay" @input="onVariableInput" />
		<span :class="BRACES">{{ '\}\}' }}</span>
	</template>

	<template v-else>
		<template v-if="['_eq', '_neq', '_lt', '_gt', '_lte', '_gte'].includes(comparator)">
			<!-- Backoffice (spec 028, D-206): a chip for `$FIELD(b)`, else the value control and the field picker. -->
			<BoMenu v-if="canCompareField && compareWith !== null" :items="compareItems">
				<template #trigger>
					<button
						ref="chipEl"
						type="button"
						:class="[
							CHIP,
							compareMissing ? 'text-error-500 dark:text-error-400' : 'text-brand-500 dark:text-brand-400',
						]"
						:aria-label="t('field_compare_with', { field: compareLabel })"
						:aria-invalid="compareMissing ? 'true' : undefined"
						:title="compareMissing ? t('field_compare_missing', { field: compareWith }) : t('field_compare')"
					>
						<BoIcon name="swap_horiz" size="sm" />
						{{ compareLabel }}
					</button>
				</template>
			</BoMenu>
			<template v-else>
				<InputComponent
					:is="interfaceType"
					:choices="choices"
					:type="fieldInfo?.type ?? 'unknown'"
					:value="value as ScalarValue"
					@input="value = $event"
				/>
				<BoMenu v-if="canCompareField" :items="compareItems">
					<template #trigger>
						<button type="button" :class="PICKER" :aria-label="t('field_compare')" :title="t('field_compare')">
							<BoIcon name="swap_horiz" size="sm" />
						</button>
					</template>
				</BoMenu>
			</template>
		</template>
		<template
			v-else-if="
				[
					'_contains',
					'_ncontains',
					'_icontains',
					'_starts_with',
					'_istarts_with',
					'_nstarts_with',
					'_nistarts_with',
					'_ends_with',
					'_iends_with',
					'_nends_with',
					'_niends_with',
					'_regex',
				].includes(comparator)
			"
		>
			<InputComponent
				is="interface-input"
				:choices="choices"
				:type="fieldInfo?.type ?? 'unknown'"
				:value="value as ScalarValue"
				@input="value = $event"
			/>
		</template>

		<span v-else-if="['_in', '_nin'].includes(comparator)" class="inline-flex flex-wrap items-center">
			<span
				v-for="(val, index) in value as ScalarValue[]"
				:key="index"
				class="inline-flex items-center"
				:class="{ [COMMA]: index < (value as ScalarValue[]).length - 1 }"
			>
				<InputComponent
					:is="interfaceType"
					:ref="(el) => (inputRefs[index] = el)"
					:type="fieldInfo?.type ?? 'unknown'"
					:value="val"
					:focus="false"
					:choices="choices"
					comma-allowed
					@input="setValueAt(index, $event)"
					@comma-key-pressed="handleCommaKeyPressed(index)"
					@comma-value-pasted="handleCommaValuePasted($event)"
				/>
			</span>
		</span>

		<template v-else-if="['_between', '_nbetween'].includes(comparator)">
			<InputComponent
				:is="interfaceType"
				:choices="choices"
				:type="fieldInfo?.type ?? 'unknown'"
				:value="(value as (string | number)[])[0] ?? ''"
				@input="setValueAt(0, $event)"
			/>
			<span class="mx-1.5 text-theme-sm text-gray-500 dark:text-gray-400">{{ $t('interfaces.filter.and') }}</span>
			<InputComponent
				:is="interfaceType"
				:choices="choices"
				:type="fieldInfo?.type ?? 'unknown'"
				:value="(value as (string | number)[])[1] ?? ''"
				@input="setValueAt(1, $event)"
			/>
		</template>
	</template>
</template>
