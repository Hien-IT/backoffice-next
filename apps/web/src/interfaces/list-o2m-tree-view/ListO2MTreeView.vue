<!-- Ported from directus/app/src/interfaces/list-o2m-tree-view/list-o2m-tree-view.vue -->
<script setup lang="ts">
// Backoffice: the tree is a group linked to the field label (FR-094). A related collection missing from the
// collections store (no read permission) shows the recursive-only notice instead of throwing. `version` defaults to
// null (the form may pass undefined, which use-relation-multiple would read as a version). v-prevent-focusout is not
// needed (drawers are portals).
import type { ContentVersion, Filter } from '@directus/types';
import { deepMap, getFieldsFromTemplate } from '@directus/utils';
import { render } from 'micromustache';
import { computed, inject, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import BoNotice from '../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseFilter } from '../../components/form/utils/parse-filter.ts';
import type { ChangesItem } from '../../composables/use-relation-multiple.ts';
import { useRelationO2M } from '../../composables/use-relation-o2m.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { addRelatedPrimaryKeyToFields } from '../../utils/add-related-primary-key-to-fields.ts';
import NestedDraggable from './NestedDraggable.vue';

const props = withDefaults(
	defineProps<{
		value?: (number | string | Record<string, any>)[] | Record<string, any> | null;
		disabled?: boolean;
		nonEditable?: boolean;
		collection: string;
		field: string;
		primaryKey: string | number;
		version?: ContentVersion | null;
		displayTemplate?: string | null | undefined;
		enableCreate?: boolean;
		enableSelect?: boolean;
		filter?: Filter | null;
	}>(),
	{
		value: () => [],
		disabled: false,
		nonEditable: false,
		version: null,
		enableCreate: true,
		enableSelect: true,
		filter: null,
		displayTemplate: undefined,
	},
);

defineOptions({ name: 'InterfaceListO2MTreeView' });

const emit = defineEmits(['input']);
const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);
const { collection, field, primaryKey } = toRefs(props);

const _value = computed<ChangesItem>({
	get() {
		if (Array.isArray(props.value)) {
			return {
				create: [],
				update: [],
				delete: [],
			};
		}

		return props.value as ChangesItem;
	},
	set: (val) => {
		emit('input', val);
	},
});

const values = inject('values', ref<Record<string, any>>({}));

const customFilter = computed(() => {
	return parseFilter(
		deepMap(props.filter, (val: any) => {
			if (val && typeof val === 'string') {
				return render(val, values.value);
			}

			return val;
		}),
	);
});

const itemsMoved = computed(() => {
	const pkField = relationInfo.value?.relatedPrimaryKeyField.field;
	if (!pkField) return [];

	return map(_value.value, (item) => {
		if (typeof item === 'object') {
			return item[pkField] as string | number;
		}

		return item;
	});
});

function map<T>(item: ChangesItem | undefined, fn: (v: Record<string, any> | string | number) => T): T[] {
	if (item === undefined || Array.isArray(item ?? [])) return [];
	return [
		...item.update.map(fn),
		...item.delete.map(fn),
		...item.create.map((i) => map(i[field.value], fn)).flat(),
		...item.update.map((i) => map(i[field.value], fn)).flat(),
	];
}

const { relationInfo: o2mRelationInfo } = useRelationO2M(collection, field);

// Backoffice: a related collection missing from the collections store (no read permission) counts as no relation.
const relationInfo = computed(() => (o2mRelationInfo.value?.relatedCollection ? o2mRelationInfo.value : undefined));

const template = computed(() => {
	return (
		props.displayTemplate ||
		relationInfo.value?.relatedCollection?.meta?.display_template ||
		`{{${relationInfo.value?.relatedPrimaryKeyField.field}}}`
	);
});

const fields = computed(() => {
	if (!relationInfo.value) return [];

	const displayFields = adjustFieldsForDisplays(
		getFieldsFromTemplate(template.value),
		relationInfo.value.relatedCollection.collection,
	);

	return addRelatedPrimaryKeyToFields(relationInfo.value?.relatedCollection.collection ?? '', displayFields);
});

const addNewOpen = ref(false);
const selectOpen = ref(false);
</script>

<template>
	<BoNotice v-if="!relationInfo || collection !== relationInfo?.relatedCollection.collection" type="warning">
		{{ t('interfaces.list-o2m-tree-view.recursive_only') }}
	</BoNotice>
	<BoNotice v-else-if="relationInfo.relatedCollection.meta?.singleton" type="warning">
		{{ t('no_singleton_relations') }}
	</BoNotice>
	<div
		v-else
		class="tree-view"
		role="group"
		:aria-labelledby="a11y?.labelId"
		:aria-describedby="a11y?.describedBy"
		:aria-invalid="a11y?.invalid || undefined"
	>
		<NestedDraggable
			v-model="_value"
			v-model:add-new-open="addNewOpen"
			v-model:select-open="selectOpen"
			:template="template"
			:collection="collection"
			:field="field"
			:primary-key="primaryKey"
			:relation-info="relationInfo"
			:disabled="disabled"
			:non-editable="nonEditable"
			:fields="fields"
			:enable-create="enableCreate"
			:enable-select="enableSelect"
			:custom-filter="customFilter"
			:items-moved="itemsMoved"
			:version
			root
		/>
	</div>
</template>
