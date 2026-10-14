<!-- Ported from directus/app/src/interfaces/list/list.vue -->
<script setup lang="ts">
// Backoffice: rows are a BoSortableList (drag handle + "Move up"/"Move down" row menu, D-60) whose menu also holds
// "Remove Item" (v-remove `confirm`); a row is a button that opens the item drawer. The unused `internalValue`
// setter, the `dense` rows and v-prevent-focusout are dropped. The drawer header renders the template in its title.
import formatTitle from '@directus/format-title';
import type { DeepPartial, Field } from '@directus/types';
import { isEqual, sortBy } from 'lodash-es';
import { DialogTitle } from 'reka-ui';
import { computed, inject, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import type { BoMenuItem } from '../../components/BoMenu.vue';
import BoNotice from '../../components/BoNotice.vue';
import { getRemoveAction } from '../../components/BoRemove.vue';
import BoSortableList from '../../components/BoSortableList.vue';
import BoDrawer from '../../components/drawers/BoDrawer.vue';
import BoForm from '../../components/form/BoForm.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { renderStringTemplate } from '../../utils/render-string-template.ts';

const props = withDefaults(
	defineProps<{
		value: Record<string, unknown>[] | null;
		fields?: DeepPartial<Field>[];
		template?: string | undefined;
		addLabel?: string | undefined;
		sort?: string | undefined;
		limit?: number | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		headerPlaceholder?: string | undefined;
		collection?: string | undefined;
		placeholder?: string | undefined;
		direction?: string | undefined;
	}>(),
	{
		fields: () => [],
		template: undefined,
		addLabel: undefined,
		sort: undefined,
		limit: undefined,
		headerPlaceholder: undefined,
		collection: undefined,
		placeholder: undefined,
		direction: undefined,
	},
);

const emit = defineEmits<{
	(e: 'input', value: Record<string, unknown>[] | null): void;
}>();

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);

const active = ref<number | null>(null);
const drawerOpen = computed(() => active.value !== null);
const { value } = toRefs(props);

// Backoffice: DeepPartial<Field> as Field for RenderTemplate and BoForm (Directus passes them untyped).
const fieldDefinitions = computed(() => props.fields as Field[]);

const templateWithDefaults = computed(() =>
	props.fields?.[0]?.field ? props.template || `{{${props.fields[0].field}}}` : '',
);

const showAddNew = computed(() => {
	if (props.value === null) return true;
	if (props.limit === undefined) return true;
	if (Array.isArray(props.value) && props.value.length < props.limit) return true;
	return false;
});

const activeItem = computed(() => (active.value !== null ? edits.value : null));

const isSaveDisabled = computed(() => {
	if (props.disabled) return true;

	for (const field of props.fields) {
		if (
			field.meta?.required &&
			field.field &&
			(edits.value[field.field] === null || edits.value[field.field] === undefined)
		) {
			return true;
		}
	}

	return false;
});

const { displayValue } = renderStringTemplate(templateWithDefaults, activeItem);

const defaults = computed(() => {
	const values: Record<string, any> = {};

	for (const field of props.fields) {
		if (field.schema?.default_value !== undefined && field.schema?.default_value !== null) {
			values[field.field!] = field.schema.default_value;
		}
	}

	return values;
});

const fieldsWithNames = computed(
	() =>
		props.fields?.map((field) => {
			return {
				...field,
				name: formatTitle(field.name ?? field.field!),
			};
		}) as Field[],
);

const internalValue = computed(() => {
	// Like Directus (list.vue): sortBy runs on any value, so with `sort` set a non-array value becomes the rows of its
	// values and the incompatible-data notice is not shown (reproduced on purpose, R-xx of spec 013).
	if (props.fields && props.sort) return sortBy(value.value, props.sort);
	return value.value;
});

const isNewItem = ref(false);
const edits = ref({} as Record<string, any>);
const confirmDiscard = ref(false);

function openItem(index: number) {
	isNewItem.value = false;

	edits.value = { ...internalValue.value?.[index] };
	active.value = index;
}

function saveItem(index: number) {
	if (isSaveDisabled.value) return;

	isNewItem.value = false;

	updateValues(index, edits.value);
	closeDrawer();
}

function trackEdits(updatedValues: any) {
	const combinedValues = Object.assign({}, defaults.value, updatedValues);
	Object.assign(edits.value, combinedValues);
}

function checkDiscard() {
	if (active.value !== null && !isEqual(edits.value, internalValue.value?.[active.value])) {
		confirmDiscard.value = true;
	} else {
		closeDrawer();
	}
}

function discardAndLeave() {
	closeDrawer();
	confirmDiscard.value = false;
}

function updateValues(index: number, updatedValues: any) {
	const newValue = internalValue.value?.map((item: any, i: number) => {
		if (i === index) {
			return updatedValues;
		}

		return item;
	});

	if (props.fields && props.sort) {
		emitValue(sortBy(newValue, props.sort));
	} else {
		emitValue(newValue);
	}
}

function removeItem(item: Record<string, any>) {
	if (value.value) {
		emitValue(internalValue.value?.filter((i) => i !== item));
	} else {
		emitValue();
	}
}

function addNew() {
	isNewItem.value = true;

	const newDefaults: any = {};

	props.fields.forEach((field) => {
		newDefaults[field.field!] = field.schema?.default_value;
	});

	if (Array.isArray(internalValue.value)) {
		emitValue([...internalValue.value, newDefaults]);
	} else {
		if (internalValue.value != null) {
			// eslint-disable-next-line no-console
			console.warn(
				'The repeater interface expects an array as value, but the given value is no array. Overriding given value.',
			);
		}

		emitValue([newDefaults]);
	}

	edits.value = { ...newDefaults };
	active.value = (internalValue.value || []).length;
}

function emitValue(value?: Record<string, unknown>[]) {
	if (!value || value.length === 0) {
		return emit('input', null);
	}

	return emit('input', value);
}

function closeDrawer() {
	if (isNewItem.value) {
		emitValue(internalValue.value?.slice(0, -1));
	}

	edits.value = {};
	active.value = null;
}

// Backoffice: the row name of the row menu label and the move announcement (D-60).
function itemLabel(item: Record<string, any>, index: number): string {
	const { displayValue } = renderStringTemplate(templateWithDefaults.value, { ...defaults.value, ...item });
	return displayValue.value || String(index + 1);
}

// Backoffice: v-remove `confirm` as a row menu item and a confirmation dialog.
const removing = ref<Record<string, any> | null>(null);

function rowActions(item: Record<string, any>): BoMenuItem[] {
	if (props.nonEditable) return [];
	const { icon, text } = getRemoveAction({ confirm: true });
	return [{ text: t(text), icon, disabled: props.disabled, onSelect: () => (removing.value = item) }];
}

function confirmRemove() {
	if (removing.value) removeItem(removing.value);
	removing.value = null;
}

// Backoffice: vuedraggable `item-key="id"` has no id on repeater rows; a key per row object keeps moved rows apart.
const rowKeys = new WeakMap<object, number>();
let nextRowKey = 0;

function rowKey(item: unknown): string | number {
	if (typeof item !== 'object' || item === null) return String(item);

	let key = rowKeys.get(item);
	if (key === undefined) rowKeys.set(item, (key = nextRowKey++));
	return key;
}

const ROW_BUTTON =
	'block w-full min-w-0 rounded-md text-start text-sm text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="repeater space-y-3" role="group" :aria-labelledby="a11y?.labelId" :aria-describedby="a11y?.describedBy">
		<BoNotice v-if="(Array.isArray(internalValue) && internalValue.length === 0) || internalValue == null">
			{{ placeholder || t('no_items') }}
		</BoNotice>
		<BoNotice v-else-if="!Array.isArray(internalValue)" type="warning">
			<p>{{ t('interfaces.list.incompatible_data') }}</p>
		</BoNotice>

		<BoSortableList
			v-if="Array.isArray(internalValue) && internalValue.length > 0"
			:model-value="internalValue"
			:item-key="rowKey"
			:item-label="itemLabel"
			:disabled="disabled || nonEditable || !!sort"
			:row-actions="rowActions"
			@update:model-value="$emit('input', $event)"
		>
			<template #item="{ element, index }">
				<button
					type="button"
					class="row-open"
					:class="ROW_BUTTON"
					:disabled="disabled && !nonEditable"
					@click="openItem(index)"
				>
					<RenderTemplate
						:fields="fieldDefinitions"
						:item="{ ...defaults, ...element }"
						:direction="direction"
						:template="templateWithDefaults"
					/>
				</button>
			</template>
		</BoSortableList>

		<div v-if="!nonEditable" class="actions">
			<BoButton v-if="showAddNew" :disabled="!!disabled" @click="addNew">
				{{ addLabel || t('create_new') }}
			</BoButton>
		</div>

		<BoDrawer
			:model-value="drawerOpen"
			:title="displayValue || headerPlaceholder || t('empty_item')"
			persistent
			@update:model-value="checkDiscard()"
			@cancel="checkDiscard()"
			@apply="saveItem(active!)"
		>
			<template #title>
				<DialogTitle class="m-0 min-w-0 truncate text-lg font-semibold text-gray-800 dark:text-white/90">
					<RenderTemplate :fields="fieldDefinitions" :item="activeItem ?? {}" :template="templateWithDefaults" />
				</DialogTitle>
			</template>

			<template #actions>
				<BoButton icon="check" :aria-label="t('save')" :disabled="isSaveDisabled" @click="saveItem(active!)" />
			</template>

			<BoForm
				:disabled="disabled"
				:non-editable="nonEditable"
				:fields="fieldsWithNames"
				:model-value="activeItem"
				:direction="direction"
				autofocus
				primary-key="+"
				@update:model-value="trackEdits($event)"
			/>
		</BoDrawer>

		<BoDialog v-model:open="confirmDiscard" :title="t('unsaved_changes')" :description="t('unsaved_changes_copy')">
			<template #actions>
				<BoButton variant="secondary" @click="discardAndLeave()">{{ t('discard_changes') }}</BoButton>
				<BoButton @click="confirmDiscard = false">{{ t('keep_editing') }}</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="removing !== null"
			:title="t('batch_delete_confirm', 1)"
			@update:open="(open: boolean) => !open && (removing = null)"
		>
			<template #actions>
				<BoButton variant="secondary" @click="removing = null">{{ t('cancel') }}</BoButton>
				<BoButton variant="danger" @click="confirmRemove">{{ t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
