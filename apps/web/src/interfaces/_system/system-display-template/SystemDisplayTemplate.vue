<!-- Ported from directus/app/src/interfaces/_system/system-display-template/system-display-template.vue -->
<script setup lang="ts">
// Backoffice: the Directus chip editor (VFieldTemplate of the spec 020 shim) on the field tree of the collection, the
// version field injected when versioning is on (owner 2026-10-23, D-166: it replaced a text input with a field picker).
// The form label names the textbox through aria-labelledby (a contenteditable is not labelable by `for`).
import { computed, inject, ref } from 'vue';
import BoNotice from '../../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useFakeVersionField } from '../../../composables/use-fake-version-field.ts';
import { type FieldNode, useFieldTree } from '../../../composables/use-field-tree.ts';
import VFieldTemplate from '../../../directus-shim/components/VFieldTemplate.vue';
import { useCollectionsStore } from '../../../stores/collections.ts';

const props = withDefaults(
	defineProps<{
		value: string | null;
		placeholder?: string | null;
		disabled?: boolean;
		collectionField?: string;
		collectionName?: string;
		fields?: FieldNode[];
		injectVersionField?: boolean;
		includeRelations?: boolean;
	}>(),
	{
		includeRelations: true,
	},
);

defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const collectionsStore = useCollectionsStore();

const values = inject('values', ref<Record<string, any>>({}));

const collection = computed(() => {
	if (!props.collectionField) {
		if (props.collectionName) return props.collectionName;
		return null;
	}

	const collectionName = values.value[props.collectionField];

	const collectionExists = !!collectionsStore.collections.find(
		(collection) => collection.collection === collectionName,
	);

	if (collectionExists === false) return null;
	return collectionName;
});

const versioningEnabled = computed(() => Boolean(values.value['versioning'] && props.injectVersionField));
const { fakeVersionField } = useFakeVersionField(collection, versioningEnabled);

const injectFields = computed(() => {
	return fakeVersionField.value ? { fields: [fakeVersionField.value] } : null;
});

const { treeList, loadFieldRelations } = useFieldTree(collection, injectFields, () => true, props.includeRelations);

const tree = computed(() => {
	if (props.fields) {
		return { list: props.fields };
	}

	if (collection.value === null) {
		return null;
	}

	return { list: treeList.value, pathLoader: loadFieldRelations };
});

const labelling = computed(() => ({
	...(a11y?.value.labelId ? { 'aria-labelledby': a11y.value.labelId } : {}),
	...(a11y?.value.describedBy ? { 'aria-describedby': a11y.value.describedBy } : {}),
}));
</script>

<template>
	<div class="system-display-template">
		<BoNotice v-if="tree === null">
			{{ $t('interfaces.system-display-template.select_a_collection') }}
		</BoNotice>
		<VFieldTemplate
			v-else
			v-bind="{ ...labelling, ...(tree.pathLoader ? { loadPathLevel: tree.pathLoader } : {}) }"
			:tree="tree.list"
			:model-value="value"
			:disabled="disabled"
			:placeholder="placeholder"
			@update:model-value="$emit('input', $event)"
		/>
	</div>
</template>
