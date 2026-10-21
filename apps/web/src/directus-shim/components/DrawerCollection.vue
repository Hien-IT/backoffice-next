<!-- Ported from directus/app/src/views/private/components/drawer-collection.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the global drawer-collection of Directus on the app's DrawerCollection, which
// passes every slot of the caller to the drawer. `active` is a Boolean prop here as in Directus (absent = closed).
import type { Filter } from '@directus/types';
import AppDrawerCollection from '../../components/drawers/DrawerCollection.vue';

withDefaults(
	defineProps<{
		active?: boolean;
		selection?: (number | string)[];
		collection: string;
		multiple?: boolean;
		filter?: Filter | undefined;
		drawerProps?: Record<string, any> | undefined;
	}>(),
	{ selection: () => [], filter: undefined, drawerProps: undefined },
);

defineEmits<{
	(e: 'update:active', value: boolean): void;
	(e: 'input', value: (number | string)[] | null): void;
}>();
</script>

<template>
	<AppDrawerCollection
		:active="active"
		:selection="selection"
		:collection="collection"
		:multiple="!!multiple"
		:filter="filter"
		:drawer-props="drawerProps"
		@update:active="$emit('update:active', $event)"
		@input="$emit('input', $event)"
	>
		<template v-for="(_, slot) in $slots" #[slot]="scope">
			<slot :name="slot" v-bind="scope || {}" />
		</template>
	</AppDrawerCollection>
</template>
