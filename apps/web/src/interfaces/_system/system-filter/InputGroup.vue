<!-- Ported from directus/app/src/interfaces/_system/system-filter/input-group.vue -->
<script setup lang="ts">
// Backoffice: `$version` (useFakeVersionField) is not ported: the version field is not injected in FieldList yet (see
// FieldList.vue), so a `$version` rule falls back to a text input like any unknown field. Icon buttons are buttons
// with labels (FR-027); `{{ }}` braces of the variable input are text around a compact input.
import type { FieldFilter } from '@directus/types';
import { clone, get } from 'lodash-es';
import { computed, nextTick, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import InputComponent from './InputComponent.vue';
import { fieldToFilter, getComparator, getField } from './utils.ts';

// Workaround because you cannot cast directly to union types inside
// the template block without running into eslint/prettier issues
type ScalarValue = string | boolean | number | null;

const props = defineProps<{
	field: FieldFilter;
	collection: string;
	variableInputEnabled?: boolean | undefined;
}>();

const emit = defineEmits<{
	(e: 'update:field', value: FieldFilter): void;
}>();

const { t } = useI18n();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const fieldPath = computed(() => getField(props.field));

const fieldInfo = computed(() => {
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
	return get(props.field, `${fieldPath.value}.${comparator.value}`);
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

// Directus `.list .value:not(:last-child)::after { content: ',' }`.
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
			<InputComponent
				:is="interfaceType"
				:choices="choices"
				:type="fieldInfo?.type ?? 'unknown'"
				:value="value as ScalarValue"
				@input="value = $event"
			/>
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
