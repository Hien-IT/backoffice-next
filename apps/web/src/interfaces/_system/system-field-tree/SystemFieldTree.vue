<!-- Ported from directus/app/src/interfaces/_system/system-field-tree/system-field-tree.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice, VCheckboxTree is BoCheckboxTree (exclusive value combining); opening a relational
// group loads its fields through `group-toggle`, as DR. The frame of `.system-field-tree` is the form field frame.
import { computed, inject, ref } from 'vue';
import BoCheckboxTree from '../../../components/BoCheckboxTree.vue';
import BoNotice from '../../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useFieldTree } from '../../../composables/use-field-tree.ts';

const props = defineProps<{
	collectionField?: string;
	collectionName?: string;
	value: string[] | null;
	disabled?: boolean;
	placeholder?: string;
	allowNone?: boolean;
}>();

const emit = defineEmits<{
	(e: 'input', value: string[] | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const values = inject('values', ref<Record<string, any>>({}));

const chosenCollection = computed(() => values.value[props.collectionField!] || props.collectionName);

const { treeList, loadFieldRelations } = useFieldTree(chosenCollection);
</script>

<template>
	<BoNotice v-if="!collectionField && !collectionName" type="warning">
		{{ $t('collection_field_not_setup') }}
	</BoNotice>
	<BoNotice v-else-if="!chosenCollection" type="warning">
		{{ $t('select_a_collection') }}
	</BoNotice>
	<div v-else class="rounded-lg border border-gray-300 p-2 dark:border-gray-700">
		<BoCheckboxTree
			v-bind="a11y?.inputId ? { id: a11y.inputId } : {}"
			:model-value="value"
			:disabled="!!disabled"
			:choices="treeList"
			item-text="name"
			item-value="key"
			value-combining="exclusive"
			@update:model-value="emit('input', $event as string[])"
			@group-toggle="$event.open && loadFieldRelations($event.value)"
		/>
	</div>
</template>
