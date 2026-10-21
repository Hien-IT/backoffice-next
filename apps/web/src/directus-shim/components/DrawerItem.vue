<!-- Ported from directus/app/src/views/private/components/drawer-item.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the global drawer-item of Directus on the app's DrawerItem. As Directus the
// props have no default here (overlay-item.vue fills them in), so unset ones are left to DrawerItem, except
// `preventCancelWithEdits`, a Boolean that is false when absent as in Directus. `overlay` is forced to the drawer as
// drawer-item.vue does, and `popoverProps` is accepted and ignored (no popover overlay).
import type { PrimaryKey } from '@directus/types';
import { computed } from 'vue';
import AppDrawerItem from '../../components/drawers/DrawerItem.vue';

const props = defineProps<{
	overlay?: 'drawer' | 'modal' | 'popover';
	collection: string;
	active?: boolean;
	primaryKey?: PrimaryKey | null;
	edits?: Record<string, any>;
	junctionField?: string | null;
	disabled?: boolean;
	nonEditable?: boolean;
	relatedPrimaryKey?: PrimaryKey;
	circularField?: string | null;
	junctionFieldLocation?: string;
	selectedFields?: string[] | null;
	popoverProps?: Record<string, any>;
	applyShortcut?: string;
	preventCancelWithEdits?: boolean;
	version?: string | null;
}>();

defineEmits<{
	'update:active': [value: boolean];
	input: [value: Record<string, any>];
}>();

const drawerProps = computed(() => {
	const { overlay: _overlay, popoverProps: _popoverProps, ...rest } = props;
	return Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
});
</script>

<template>
	<AppDrawerItem
		v-bind="drawerProps"
		:collection="collection"
		@update:active="$emit('update:active', $event)"
		@input="$emit('input', $event)"
	>
		<template #actions><slot name="actions" /></template>
	</AppDrawerItem>
</template>
