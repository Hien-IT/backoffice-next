<!-- Ported from directus/app/src/interfaces/_system/system-filter/system-filter.vue -->
<script setup lang="ts">
// Backoffice: recipe "Search and advanced filter (Q-7)": the rule list is a bordered box (none when `inline`), "Add
// filter" is a ghost button opening FieldList (readable fields only, functions, lazy relations) in a Reka popover with
// "And / Or group" on top, as the Directus v-menu + v-field-list `#prepend`. `injectVersionField` is accepted but
// not used: FieldList has no `$version` field yet (see FieldList.vue). Values, operators and the emitted JSON follow
// Directus (SC-004).
import type { ClientFilterOperator, FieldFunction, Filter, Type } from '@directus/types';
import {
	getFilterOperatorsForType,
	getOutputTypeForFunction,
	parseFilterFunctionPath,
	parseJSON,
} from '@directus/utils';
import { cloneDeep, get, isEmpty, set } from 'lodash-es';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, inject, ref } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoNotice from '../../../components/BoNotice.vue';
import FieldList from '../../../components/FieldList.vue';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import Nodes from './Nodes.vue';
import { getNodeName } from './utils.ts';

interface Props {
	value?: Record<string, any> | string | null | undefined;
	disabled?: boolean;
	collectionName?: string | undefined;
	collectionField?: string | undefined;
	collectionRequired?: boolean;

	/**
	 * Lock the interface to only allow configuring filters for the given fieldName
	 */
	fieldName?: string | undefined;

	inline?: boolean;
	includeValidation?: boolean;
	includeRelations?: boolean;
	injectVersionField?: boolean;
	relationalFieldSelectable?: boolean;
	rawFieldNames?: boolean;
	rawEditorEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	value: undefined,
	disabled: false,
	collectionName: undefined,
	collectionField: undefined,
	collectionRequired: true,
	fieldName: undefined,
	inline: false,
	includeValidation: false,
	includeRelations: true,
	injectVersionField: false,
	relationalFieldSelectable: true,
	rawFieldNames: false,
});

const emit = defineEmits<{ input: [value: Filter | null] }>();

const menuOpen = ref(false);

const values = inject('values', ref<Record<string, any>>({}));

const collection = computed(() => {
	if (props.collectionName) return props.collectionName;
	return values.value[props.collectionField!] ?? null;
});

const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const innerValue = computed<Filter[]>({
	get() {
		const filterValue = typeof props.value === 'string' ? parseJSON(props.value) : props.value;

		if (!filterValue || isEmpty(filterValue)) return [];

		const name = getNodeName(filterValue);

		if (name === '_and') {
			return cloneDeep(filterValue['_and']);
		} else {
			return cloneDeep([filterValue]);
		}
	},
	set(newVal) {
		if (newVal.length === 0) {
			emit('input', null);
		} else {
			emit('input', { _and: newVal });
		}
	},
});

function emitValue() {
	if (innerValue.value.length === 0) {
		emit('input', null);
	} else {
		emit('input', { _and: innerValue.value });
	}
}

function addNode(key: string) {
	menuOpen.value = false;

	if (key === '$group') {
		innerValue.value = innerValue.value.concat({ _and: [] });
	} else {
		let type: Type;
		const field = fieldsStore.getField(collection.value, key);
		const isVersion = key === '$version';

		if (isVersion) {
			type = 'string';
		} else if (key.includes('(') && key.includes(')')) {
			const functionName = key.split('(')[0] as FieldFunction;
			type = getOutputTypeForFunction(functionName);
			key = parseFilterFunctionPath(key);
		} else {
			type = field?.type || 'unknown';

			// Alias uses the foreign key type
			if (type === 'alias') {
				const relations = relationsStore.getRelationsForField(collection.value, key);

				if (relations[0]) {
					type = fieldsStore.getField(relations[0].collection, relations[0].field!)?.type || 'unknown';
				}
			}
		}

		const filterOperators = getFilterOperatorsForType(type, { includeValidation: props.includeValidation });

		const operator =
			isVersion || (field?.meta?.options?.['choices'] && filterOperators.includes('eq')) ? 'eq' : filterOperators[0];

		const booleanOperators: ClientFilterOperator[] = ['empty', 'nempty', 'null', 'nnull'];
		const initialValue = operator && booleanOperators.includes(operator) ? true : null;

		const node = set({}, key, { ['_' + operator]: initialValue });
		innerValue.value = innerValue.value.concat(node);
	}
}

function removeNode(ids: string[]) {
	const id = ids.pop();

	if (ids.length === 0) {
		innerValue.value = innerValue.value.filter((_node, index) => index !== Number(id));
		return;
	}

	let list = get(innerValue.value, ids.join('.')) as Filter[];

	list = list.filter((_node, index) => index !== Number(id));

	innerValue.value = set(innerValue.value, ids.join('.'), list);
}

// For adding any new fields (eg. flow Validate operation rule)
const newKey = ref<string | null>(null);

function addKeyAsNode() {
	if (!newKey.value) return;
	addNode(newKey.value);
	newKey.value = null;
}

const ADD_BTN =
	'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-theme-sm font-medium text-brand-500 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/15 dark:focus-visible:outline-brand-400';
const MENU_ITEM =
	'menu-dropdown-item menu-dropdown-item-inactive min-h-9 w-full cursor-pointer gap-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<BoNotice v-if="collectionRequired && !collectionField && !collection" type="warning">
		{{ $t('collection_field_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="collectionRequired && !collection" type="warning">
		{{ $t('select_a_collection') }}
	</BoNotice>

	<div v-else class="system-filter" :class="{ inline, empty: innerValue.length === 0, field: fieldName !== undefined }">
		<div
			v-if="!(inline && innerValue.length === 0)"
			:class="
				inline ? 'mb-2' : 'mb-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900'
			"
		>
			<p v-if="innerValue.length === 0" class="font-mono text-theme-sm text-gray-500 dark:text-gray-400">
				{{ $t('interfaces.filter.no_rules') }}
			</p>

			<Nodes
				v-else
				v-model:filter="innerValue"
				:collection="collection"
				:field="fieldName"
				:depth="1"
				:include-validation="includeValidation"
				:include-relations="includeRelations"
				:relational-field-selectable="relationalFieldSelectable"
				:raw-field-names="rawFieldNames"
				:variable-input-enabled="rawEditorEnabled"
				@remove-node="removeNode($event)"
				@change="emitValue"
			/>
		</div>

		<div v-if="fieldName" class="flex gap-4">
			<button type="button" :class="ADD_BTN" @click="addNode(fieldName!)">
				{{ $t('interfaces.filter.add_filter') }}
			</button>
			<button type="button" :class="ADD_BTN" @click="addNode('$group')">
				{{ $t('interfaces.filter.add_group') }}
			</button>
		</div>
		<PopoverRoot v-else v-model:open="menuOpen">
			<PopoverTrigger class="add-filter" :class="ADD_BTN">
				<BoIcon name="add" size="sm" />
				<span class="whitespace-nowrap">{{ $t('interfaces.filter.add_filter') }}</span>
				<BoIcon
					name="expand_more"
					size="sm"
					class="transition-transform motion-reduce:transition-none"
					:class="{ '-scale-y-100': menuOpen }"
				/>
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
					<FieldList
						v-if="collectionRequired"
						:collection="collection"
						include-functions
						:include-relations="includeRelations"
						:relational-field-selectable="relationalFieldSelectable"
						:allow-select-all="false"
						:raw-field-names="rawFieldNames"
						@add="addNode($event[0]!)"
					>
						<template #prepend>
							<button type="button" class="add-group" :class="MENU_ITEM" @click="addNode('$group')">
								{{ $t('interfaces.filter.add_group') }}
							</button>
							<hr class="border-gray-200 dark:border-gray-800" />
						</template>
					</FieldList>

					<div v-else class="flex flex-col gap-2">
						<button type="button" class="add-group" :class="MENU_ITEM" @click="addNode('$group')">
							{{ $t('interfaces.filter.add_group') }}
						</button>
						<hr class="border-gray-200 dark:border-gray-800" />
						<input
							v-model="newKey"
							class="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30"
							:placeholder="$t('interfaces.filter.add_key_placeholder')"
							:aria-label="$t('interfaces.filter.add_key_placeholder')"
							@keydown.enter="addKeyAsNode"
						/>
					</div>
				</PopoverContent>
			</PopoverPortal>
		</PopoverRoot>
	</div>
</template>
