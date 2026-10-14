<!-- Ported from directus/app/src/views/private/components/drawer-item.vue; Ported from directus/app/src/views/private/components/overlay-item.vue; Ported from directus/app/src/views/private/components/overlay-item-content.vue -->
<script setup lang="ts">
// Backoffice: drawer-item.vue is a wrapper of overlay-item.vue (overlay="drawer"); the drawer branch of overlay-item.vue
// and overlay-item-content.vue are folded in here (no modal or popover overlay: no 013 interface opens one). Collab and
// the comparison modal are removed (D-54), the route-leave guard (use-edits-guard) comes with the item screens (014),
// item permissions come from /permissions/me only (see usePermissions below), there are no nested validation errors
// (use-nested-validation) and no `version` prop (visual editor only). Unexpected errors keep only their console
// warning until the notifications store has snackbars (D-45).
import type { Field, PrimaryKey, Relation } from '@directus/types';
import { getEndpoint } from '@directus/utils';
import { cloneDeep, isEmpty, set } from 'lodash-es';
import { DialogTitle } from 'reka-ui';
import { computed, type Ref, ref, toRefs, unref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { useCollection } from '../../composables/use-collection.ts';
import { useFlows } from '../../composables/use-run-manual-flow.ts';
import { useTemplateData } from '../../composables/use-template-data.ts';
import FlowDialogs from '../../interfaces/presentation-header/FlowDialogs.vue';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoIcon from '../BoIcon.vue';
import FilePreview from '../files/FilePreview.vue';
import BoForm from '../form/BoForm.vue';
import { clearHiddenFieldsByCondition } from '../form/utils/clear-hidden-fields-by-condition.ts';
import { getDefaultValuesFromFields } from '../form/utils/get-default-values-from-fields.ts';
import { mergeItemData } from '../form/utils/merge-item-data.ts';
import { validateItem } from '../form/utils/validate-item.ts';
import ValidationErrors from '../form/ValidationErrors.vue';
import RenderTemplate from '../render/RenderTemplate.vue';
import BoDrawer, { type ApplyShortcut } from './BoDrawer.vue';

export interface DrawerItemProps {
	collection: string;
	active?: boolean | undefined;
	primaryKey?: PrimaryKey | null;
	edits?: Record<string, any> | undefined;
	junctionField?: string | null;
	disabled?: boolean;
	nonEditable?: boolean;
	// There's an interesting case where the main form can be a newly created item ('+'), while
	// it has a pre-selected related item it needs to alter. In that case, we have to fetch the
	// related data anyway.
	relatedPrimaryKey?: PrimaryKey;
	// If this drawer-item is opened from a relational interface, we need to force-block the field
	// that relates back to the parent item.
	circularField?: string | null;
	junctionFieldLocation?: string;
	selectedFields?: string[] | null;
	applyShortcut?: ApplyShortcut;
	/** Backoffice: true by default, a drawer with edits asks before discarding them (FR-084). */
	preventCancelWithEdits?: boolean;
}

const props = withDefaults(defineProps<DrawerItemProps>(), {
	active: undefined,
	primaryKey: null,
	edits: undefined,
	junctionField: null,
	disabled: false,
	nonEditable: false,
	relatedPrimaryKey: '+',
	circularField: null,
	junctionFieldLocation: 'bottom',
	selectedFields: null,
	applyShortcut: 'meta+enter',
	preventCancelWithEdits: true,
});

const emit = defineEmits<{
	'update:active': [value: boolean];
	input: [value: Record<string, any>];
}>();

const { t, te } = useI18n();

const validationErrors = ref<any[]>([]);

const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const { internalActive } = useActiveState();

const { junctionFieldInfo, relatedCollection, relatedCollectionInfo, relatedPrimaryKeyField } = useRelation();

const { internalEdits, loading, initialValues, refresh } = useItem();

const { save, cancel, overlayActive } = useActions();

const { collection, primaryKey } = toRefs(props);

const { info: collectionInfo, primaryKeyField } = useCollection(collection);

const isNew = computed(() => props.primaryKey === '+' && props.relatedPrimaryKey === '+');

const hasEdits = computed(() => !isEmpty(internalEdits.value));
const { confirmCancel, discardAndCancel, confirmCancellation } = useCancelGuard();

const title = computed(() => {
	const collection = relatedCollectionInfo?.value || collectionInfo.value;

	if (!collection) return '';

	if (te(`collection_names_singular.${collection.collection}`)) {
		return isNew.value
			? t('creating_unit', {
					unit: t(`collection_names_singular.${collection.collection}`),
				})
			: t('editing_unit', {
					unit: t(`collection_names_singular.${collection.collection}`),
				});
	}

	return isNew.value
		? t('creating_in', { collection: collection.name })
		: t('editing_in', { collection: collection.name });
});

const { fields: fieldsWithPermissions, saveAllowed } = usePermissions(
	collection,
	computed(() => props.primaryKey === '+'),
);

const { fields: relatedCollectionFields, saveAllowed: saveRelatedCollectionAllowed } = usePermissions(
	relatedCollection,
	computed(() => props.relatedPrimaryKey === '+'),
);

const fields = computed(() => {
	const availableFields = fieldsWithPermissions.value.map((field: Field) => {
		if (props.circularField && field.field === props.circularField) set(field, 'meta.readonly', true);
		return field;
	});

	if (!props.selectedFields?.length) return availableFields;

	const selectedGroupKeys = getSelectedGroupKeys();

	const selectedAvailableFields = availableFields.filter((field) => {
		const groupKey = field.meta?.group;

		if (groupKey && selectedGroupKeys.includes(groupKey)) return true;

		if (groupKey && !selectedGroupKeys.includes(groupKey)) field.meta!.group = null;
		return isSelected(field.field);
	});

	if (!selectedAvailableFields.length) return availableFields;

	return selectedAvailableFields;

	function isSelected(fieldKey: string) {
		return props.selectedFields!.includes(fieldKey);
	}

	function getSelectedGroupKeys() {
		const groupKeys: string[] = [];

		availableFields.forEach((field) => {
			const isGroup = field.meta?.special?.includes('group');
			if (!isGroup) return;

			if (isSelected(field.field)) groupKeys.push(field.field);
		});

		return addNestedGroupKeys(groupKeys);
	}

	function addNestedGroupKeys(groupKeys: string[]) {
		availableFields.forEach((field) => {
			const isGroup = field.meta?.special?.includes('group');
			if (!isGroup) return;

			const groupIsAlreadySelected = groupKeys.includes(field.field);
			if (groupIsAlreadySelected) return;

			const groupKey = field.meta?.group;
			if (!groupKey) return;

			const parentGroupIsSelected = groupKeys.includes(groupKey);
			if (!parentGroupIsSelected) return;

			groupKeys.push(field.field);
			groupKeys = addNestedGroupKeys(groupKeys);
		});

		return groupKeys;
	}
});

const fieldsWithoutCircular = computed(() => {
	if (props.circularField) {
		return fields.value.filter((field) => {
			return field.field !== props.circularField;
		});
	} else {
		return fields.value;
	}
});

const templatePrimaryKey = computed(() =>
	junctionFieldInfo.value ? String(props.relatedPrimaryKey) : String(props.primaryKey),
);

const templateCollection = computed(() => relatedCollectionInfo.value || collectionInfo.value);

const isSavable = computed(() => {
	if (props.disabled || (!hasEdits.value && !isNew.value)) return false;
	if (!relatedCollection.value) return saveAllowed.value;
	return saveAllowed.value || saveRelatedCollectionAllowed.value;
});

const {
	template,
	templateData,
	loading: templateDataLoading,
} = useTemplateData(templateCollection, templatePrimaryKey);

const { flowDialogsContext, provideRunManualFlow } = useFlows({
	collection,
	primaryKey,
	location: 'item',
	hasEdits,
	onRefreshCallback: refresh,
});

provideRunManualFlow();

const { mainInitialValues, junctionInitialValues } = useInitialValues();
const file = useFile();

const swapFormOrder = computed(() => props.junctionFieldLocation === 'top');
const hasVisibleFieldsRelated = computed(() => relatedCollectionFields.value.some((field) => !field.meta?.hidden));
const hasVisibleFieldsJunction = computed(() => fields.value.some((field) => !field.meta?.hidden));
const emptyForm = computed(() => !hasVisibleFieldsRelated.value && !hasVisibleFieldsJunction.value);

const contentEl = useTemplateRef<HTMLElement>('content');

function useActiveState() {
	const localActive = ref(false);

	const internalActive = computed({
		get() {
			return props.active ?? localActive.value;
		},
		set(newActive: boolean) {
			localActive.value = newActive;
			emit('update:active', newActive);
		},
	});

	return { internalActive };
}

function useItem() {
	const internalEdits = ref<Record<string, any>>({});
	const loading = ref(false);
	const initialValues = ref<Record<string, any> | null>(null);

	watch(
		() => props.active,
		(isActive) => {
			if (isActive) {
				if (props.primaryKey !== '+') fetchItem();
				if (props.relatedPrimaryKey !== '+') fetchRelatedItem();
				internalEdits.value = props.edits ?? {};
			} else {
				loading.value = false;
				initialValues.value = null;
				internalEdits.value = {};
			}
		},
		{ immediate: true },
	);

	return { internalEdits, loading, initialValues, refresh };

	async function refresh() {
		if (props.active) {
			loading.value = false;
			if (props.primaryKey !== '+') fetchItem();
			if (props.relatedPrimaryKey !== '+') fetchRelatedItem();
		}
	}

	function getFetchEndpoint(collection: string, primaryKey: PrimaryKey) {
		const baseEndpoint = getEndpoint(collection);
		if (collection.startsWith('directus_')) return `${baseEndpoint}/${primaryKey}`;
		return `${baseEndpoint}/${encodeURIComponent(primaryKey)}`;
	}

	async function fetchItem() {
		if (!props.primaryKey) return;

		loading.value = true;

		const endpoint = getFetchEndpoint(props.collection, props.primaryKey);

		let fields = '*';

		if (props.junctionField) {
			fields = `*,${props.junctionField}.*`;
		}

		try {
			initialValues.value = await sdk.request<Record<string, any>>(requestEndpoint(endpoint, { params: { fields } }));
		} catch (error) {
			internalActive.value = false;
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}

	async function fetchRelatedItem() {
		const collection = relatedCollection.value;
		if (!collection || !junctionFieldInfo.value) return;

		loading.value = true;

		const endpoint = getFetchEndpoint(collection, props.relatedPrimaryKey);

		try {
			const data = await sdk.request<Record<string, any>>(requestEndpoint(endpoint));

			initialValues.value = {
				...(initialValues.value || {}),
				[junctionFieldInfo.value.field]: data,
			};
		} catch (error) {
			internalActive.value = false;
			unexpectedError(error);
		} finally {
			loading.value = false;
		}
	}
}

function useRelation() {
	const junctionFieldInfo = computed(() => {
		if (!props.junctionField) return null;

		return fieldsStore.getField(props.collection, props.junctionField);
	});

	const relatedCollection = computed<string | null>(() => {
		if (!props.junctionField) return null;

		// If this is a m2m/m2a, there will be 2 relations associated with this field
		const relations = relationsStore.getRelationsForField(props.collection, props.junctionField);

		const relationForField = relations.find((relation: Relation) => {
			return relation.collection === props.collection && relation.field === props.junctionField;
		});

		if (!relationForField) return null;

		if (relationForField.related_collection) return relationForField.related_collection;

		if (relationForField.meta?.one_collection_field) {
			return (
				props.edits?.[relationForField.meta.one_collection_field] ||
				initialValues.value?.[relationForField.meta.one_collection_field]
			);
		}

		return null;
	});

	const { info: relatedCollectionInfo, primaryKeyField: relatedPrimaryKeyField } = useCollection(relatedCollection);

	return { junctionFieldInfo, relatedCollection, relatedCollectionInfo, relatedPrimaryKeyField };
}

function useActions() {
	watch(internalActive, (active) => {
		if (!active) validationErrors.value = [];
	});

	const overlayActive = computed({
		get() {
			return internalActive.value;
		},
		set(newActive: boolean) {
			if (newActive) internalActive.value = true;
			else cancel();
		},
	});

	return { save, cancel, overlayActive };

	function validateForm({ defaultValues, existingValues, editsToValidate, fieldsToValidate }: Record<string, any>) {
		return validateItem(
			mergeItemData(defaultValues, existingValues, editsToValidate),
			fieldsToValidate,
			isNew.value,
			true,
		);
	}

	function save() {
		if (!isSavable.value) return;

		// Backoffice: the errors carry their collection so BoForm marks the fields invalid (aria-invalid, FR-018).
		const errors = validateForm({
			defaultValues: unref(getDefaultValuesFromFields(fieldsWithoutCircular.value)),
			existingValues: initialValues?.value,
			editsToValidate: internalEdits.value,
			fieldsToValidate: fieldsWithoutCircular.value,
		}).map((error) => ({ ...error, collection: props.collection }));

		let junctionValues = null;

		if (props.junctionField) {
			junctionValues = {
				defaultValues: unref(getDefaultValuesFromFields(relatedCollectionFields.value)),
				existingValues: initialValues?.value?.[props.junctionField],
				editsToValidate: internalEdits.value[props.junctionField],
				fieldsToValidate: relatedCollectionFields.value,
			};

			const junctionErrors = validateForm(junctionValues);

			errors.push(...junctionErrors.map((error) => ({ ...error, collection: relatedCollection.value! })));
		}

		if (errors.length > 0) {
			validationErrors.value = errors;
			return;
		} else {
			validationErrors.value = [];
		}

		if (props.junctionField && Object.values(junctionValues?.defaultValues ?? {}).some((value) => value !== null)) {
			internalEdits.value[props.junctionField] = junctionValues?.editsToValidate ?? {};
		}

		if (props.junctionField && props.relatedPrimaryKey !== '+' && relatedPrimaryKeyField.value) {
			set(internalEdits.value, [props.junctionField, relatedPrimaryKeyField.value.field], props.relatedPrimaryKey);
		}

		if (props.primaryKey && props.primaryKey !== '+' && primaryKeyField.value) {
			internalEdits.value[primaryKeyField.value.field] = props.primaryKey;
		}

		const mainDefaults = unref(getDefaultValuesFromFields(fieldsWithoutCircular.value));

		internalEdits.value = clearHiddenFieldsByCondition(
			internalEdits.value,
			fieldsWithoutCircular.value,
			mainDefaults,
			initialValues.value,
		);

		if (props.junctionField && internalEdits.value[props.junctionField]) {
			const junctionDefaults = unref(getDefaultValuesFromFields(relatedCollectionFields.value));

			internalEdits.value[props.junctionField] = clearHiddenFieldsByCondition(
				internalEdits.value[props.junctionField],
				relatedCollectionFields.value,
				junctionDefaults,
				initialValues.value?.[props.junctionField],
			);
		}

		emit('input', internalEdits.value);

		internalActive.value = false;
		internalEdits.value = {};
	}

	function cancel() {
		if (confirmCancellation.value) {
			confirmCancel.value = true;
			return;
		}

		discardAndCancel();
	}
}

function useCancelGuard() {
	const confirmCancel = ref(false);

	const confirmCancellation = computed(() => {
		if (!hasEdits.value) return false;

		return props.preventCancelWithEdits;
	});

	return {
		confirmCancel,
		discardAndCancel,
		confirmCancellation,
	};

	function discardAndCancel() {
		validationErrors.value = [];
		internalEdits.value = {};
		internalActive.value = false;
		confirmCancel.value = false;
	}
}

/**
 * Backoffice: use-permissions/item (getFields, isActionAllowed) and lib/is-save-allowed.ts on the permissions store.
 * shortcut: /permissions/me/<collection>/<pk> is not in contracts/api-calls.md, so a `partial` update permission
 * counts as allowed (Directus' own fallback when that request fails); the API still checks the item on save. Upgrade
 * with the full port of use-permissions (014).
 */
function usePermissions(collection: Ref<string | null>, isNew: Ref<boolean>) {
	const userStore = useUserStore();
	const { getPermission, hasPermission } = usePermissionsStore();
	const { fields: rawFields } = useCollection(collection);

	const fields = computed(() => {
		const collectionValue = unref(collection);

		if (!collectionValue) return [];

		let fields = cloneDeep(rawFields.value);

		if (userStore.isAdmin) return fields;

		const readableFields = getPermission(collectionValue, 'read')?.fields;

		// remove fields without read permissions so they don't show up in the DOM
		if (readableFields && !readableFields.includes('*')) {
			fields = fields.filter((field) => readableFields.includes(field.field));
		}

		const permission = getPermission(collectionValue, unref(isNew) ? 'create' : 'update');

		if (!permission || permission.access === 'none') {
			for (const field of fields) {
				field.meta = { ...(field.meta || {}), readonly: true, non_editable: true } as Field['meta'];
			}
		} else if (permission.fields && !permission.fields.includes('*')) {
			for (const field of fields) {
				if (!permission.fields.includes(field.field)) {
					field.meta = { ...(field.meta || {}), readonly: true, non_editable: true } as Field['meta'];
				}
			}
		}

		const presets = permission?.presets;

		if (presets) {
			for (const field of fields) {
				if (field.field in presets) {
					field.schema = {
						...(field.schema || {}),
						default_value: presets[field.field],
					} as Field['schema'];
				}
			}
		}

		return fields;
	});

	const saveAllowed = computed(() => {
		const collectionValue = unref(collection);
		if (!collectionValue) return false;
		return hasPermission(collectionValue, unref(isNew) ? 'create' : 'update');
	});

	return { fields, saveAllowed };
}

// overlay-item-content.vue useInitialValues
function useInitialValues() {
	const mainInitialValues = computed(() => {
		const values = initialValues.value;
		const field = relatedPrimaryKeyField.value?.field;
		if (!values) return null;
		if (!props.junctionField || !values[props.junctionField] || !field) return values;

		const tempInitialValues = cloneDeep(values);
		tempInitialValues[props.junctionField] = values[props.junctionField][field];

		return tempInitialValues;
	});

	const junctionInitialValues = computed(() => {
		if (!initialValues.value || !props.junctionField || !initialValues.value[props.junctionField]) return null;
		return initialValues.value[props.junctionField];
	});

	return { mainInitialValues, junctionInitialValues };
}

// overlay-item-content.vue useFile
function useFile() {
	const isDirectusFiles = computed(() => {
		return props.collection === 'directus_files' || relatedCollection.value === 'directus_files';
	});

	return computed(() => {
		if (isDirectusFiles.value === false) return null;

		const fileData = props.junctionField ? junctionInitialValues.value : mainInitialValues.value;

		return fileData || null;
	});
}

function setRelationEdits(edits: any) {
	if (!props.junctionField) return;

	internalEdits.value[props.junctionField] = edits;
}

// overlay-item-content.vue useValidationScrollToField; Backoffice: also moves focus to the field.
function scrollToField(fieldKey: string) {
	const element = contentEl.value?.querySelector<HTMLElement>(`[data-field="${CSS.escape(fieldKey)}"]`);
	element?.scrollIntoView({ behavior: 'smooth' });
	element?.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')?.focus();
}

function unexpectedError(error: unknown): void {
	// eslint-disable-next-line no-console
	console.warn(error);
}

defineExpose({ save, cancel, hasEdits });
</script>

<template>
	<BoDrawer
		v-model="overlayActive"
		:title="title"
		:subtitle="collectionInfo?.name ?? null"
		:icon="collectionInfo?.meta?.icon ?? 'box'"
		persistent
		:apply-shortcut="applyShortcut"
		@apply="save"
		@cancel="cancel"
	>
		<template v-if="template !== null && templateData && primaryKey !== '+'" #title>
			<div
				v-if="loading || templateDataLoading"
				class="h-6 w-48 animate-pulse rounded bg-gray-200 motion-reduce:animate-none dark:bg-gray-800"
			>
				<DialogTitle class="sr-only">{{ title }}</DialogTitle>
			</div>

			<DialogTitle v-else class="m-0 min-w-0 truncate text-lg font-semibold text-gray-800 dark:text-white/90">
				<RenderTemplate :collection="templateCollection?.collection" :item="templateData" :template="template" />
			</DialogTitle>
		</template>

		<template #actions>
			<slot name="actions" />

			<BoButton icon="check" :aria-label="t('save')" :disabled="!isSavable" @click="save" />
		</template>

		<div ref="content" data-drawer-item-content>
			<FilePreview v-if="file" class="mb-5" :file="file" in-modal :disabled="disabled" :non-editable="nonEditable" />

			<div
				v-if="emptyForm"
				class="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-5 py-7 text-center dark:border-gray-800 dark:bg-white/[0.03]"
			>
				<BoIcon name="search" size="lg" class="mb-3 text-gray-500 dark:text-gray-400" />
				<p class="text-base font-medium text-gray-800 dark:text-white/90">{{ t('no_visible_fields') }}</p>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('no_visible_fields_copy') }}</p>
			</div>

			<div v-else class="flex gap-12" :class="swapFormOrder ? 'flex-col-reverse' : 'flex-col'">
				<ValidationErrors
					v-if="validationErrors.length"
					:validation-errors="validationErrors"
					:fields="[...fields, ...relatedCollectionFields]"
					@scroll-to-field="scrollToField"
				/>

				<BoForm
					v-if="junctionField"
					:model-value="internalEdits[junctionField]"
					:disabled="disabled"
					:non-editable="nonEditable"
					:loading="loading"
					:show-no-visible-fields="false"
					:show-validation-errors="false"
					:validation-errors="validationErrors"
					:initial-values="junctionInitialValues"
					:autofocus="!swapFormOrder"
					:show-divider="!swapFormOrder && hasVisibleFieldsJunction"
					:primary-key="relatedPrimaryKey"
					:fields="relatedCollectionFields"
					data-form="junction"
					@update:model-value="setRelationEdits"
				/>

				<BoForm
					v-model="internalEdits"
					:disabled="disabled"
					:non-editable="nonEditable"
					:loading="loading"
					:show-no-visible-fields="false"
					:show-validation-errors="false"
					:validation-errors="validationErrors"
					:initial-values="mainInitialValues"
					:autofocus="swapFormOrder"
					:show-divider="swapFormOrder && hasVisibleFieldsRelated"
					:primary-key="primaryKey ?? undefined"
					:fields="fields"
					data-form="main"
				/>
			</div>
		</div>
	</BoDrawer>

	<FlowDialogs v-bind="flowDialogsContext" />

	<BoDialog v-model:open="confirmCancel" :title="t('discard_all_changes')" :description="t('discard_changes_copy')">
		<template #actions>
			<BoButton variant="secondary" @click="discardAndCancel">{{ t('discard_changes') }}</BoButton>
			<BoButton @click="confirmCancel = false">{{ t('keep_editing') }}</BoButton>
		</template>
	</BoDialog>
</template>
