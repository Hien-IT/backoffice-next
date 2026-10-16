<!-- Ported from directus/app/src/interfaces/_system/system-permissions/detail/components/fields.vue -->
<script setup lang="ts">
// Backoffice: VCheckboxTree is BoCheckboxTree, which renders the `field` label itself, VNotice BoNotice; useSync
// of @directus/composables is a computed with the same get/set.
import type { Permission, Policy } from '@directus/types';
import { computed, ref } from 'vue';
import BoCheckboxTree from '../../../../components/BoCheckboxTree.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import { type FieldNode, useFieldTree } from '../../../../composables/use-field-tree.ts';
import AppMinimal from './AppMinimal.vue';

type TreeChoice = {
	text: string;
	value: string;
	disabled: boolean;
	children?: TreeChoice[] | undefined;
};

const props = defineProps<{
	permission: Permission;
	policy?: Policy | undefined;
	appMinimal?: Permission['fields'] | undefined;
}>();

const emit = defineEmits<{ 'update:permission': [Permission] }>();

// @directus/composables useSync
const permissionSync = computed({
	get: () => props.permission,
	set: (value: Permission) => emit('update:permission', value),
});
const collection = computed(() => props.permission.collection);
const isReadAction = computed(() => props.permission.action === 'read');
const { treeList } = useFieldTree(collection, ref(null), () => true, false, isReadAction.value);
const { isExpandable, openGroups, expandAll, collapseAll } = useExpandCollapseAll();

const treeFields = computed<TreeChoice[]>(() => {
	const appMinimal = new Set(props.appMinimal ?? []);

	return treeList.value.map(fieldNodeToTreeChoice);

	function fieldNodeToTreeChoice(field: FieldNode): TreeChoice {
		return {
			text: field.name,
			disabled: appMinimal.has('*') || appMinimal.has(field.field),
			value: field.field,
			children: field.children?.map(fieldNodeToTreeChoice) ?? undefined,
		};
	}
});

const selectedValues = computed({
	get() {
		const fields = new Set([...(props.appMinimal ?? []), ...(permissionSync.value.fields ?? [])]);

		if (fields.has('*')) {
			fields.delete('*');
			selectAllFieldValues(treeFields.value);
		}

		return Array.from(fields);

		function selectAllFieldValues(fieldsArr: TreeChoice[]) {
			for (const field of fieldsArr) {
				fields.add(field.value);
				if (field.children) selectAllFieldValues(field.children);
			}
		}
	},
	set(newFields: string[] | null) {
		const fields: string[] = [];

		const appMinimal = new Set(props.appMinimal ?? []);
		const previousFields = new Set(permissionSync.value.fields ?? []);

		for (const field of newFields ?? []) {
			// Ignore fields coming from app minimal permissions only
			if (appMinimal.has(field) && !previousFields.has(field)) continue;
			fields.push(field);
		}

		if (fields.length > 0) {
			permissionSync.value = {
				...permissionSync.value,
				fields,
			};
		} else {
			permissionSync.value = {
				...permissionSync.value,
				fields: null,
			};
		}
	},
});

function useExpandCollapseAll() {
	const openGroups = ref<string[] | null>(null);

	const allGroupFields = computed(() => {
		const groupFields: string[] = [];
		addGroupFields(treeList.value);

		return groupFields;

		function addGroupFields(nodes: FieldNode[]) {
			nodes
				.filter((field) => field.group)
				.forEach((field) => {
					groupFields.push(field.field);
					if (field.children) addGroupFields(field.children);
				});
		}
	});

	const isExpandable = computed(() => allGroupFields.value.length);

	return {
		isExpandable,
		openGroups,
		expandAll,
		collapseAll,
	};

	function expandAll() {
		openGroups.value = allGroupFields.value;
	}

	function collapseAll() {
		openGroups.value = [];
	}
}

const TEXT_BTN =
	'cursor-pointer rounded font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div>
		<BoNotice>
			{{
				$t('fields_for_policy', {
					policy: policy ? policy.name : $t('public_label'),
					action: $t(permission.action).toLowerCase(),
				})
			}}
		</BoNotice>

		<!-- The tree shows its own label (`field`, 0); the expand links sit above it on the end side. -->
		<div class="label-wrapper mt-6 mb-2 flex min-h-5 items-center justify-end gap-3">
			<div v-if="isExpandable" class="expand-collapse-action text-theme-sm text-gray-500 dark:text-gray-400">
				{{ $t('expand') }}
				<button type="button" :class="TEXT_BTN" @click="expandAll">{{ $t('all') }}</button>
				/
				<button type="button" :class="TEXT_BTN" @click="collapseAll">{{ $t('none') }}</button>
			</div>
		</div>

		<BoCheckboxTree
			class="permissions-field-tree"
			:model-value="selectedValues"
			:label="$t('field', 0)"
			:choices="treeFields"
			value-combining="indeterminate"
			:open-groups="openGroups"
			@update:model-value="selectedValues = $event as string[]"
			@group-toggle="openGroups = null"
		/>

		<AppMinimal :value="appMinimal" />
	</div>
</template>
