<!-- Ported from directus/app/src/interfaces/_system/system-permissions/add-collection/add-collection.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-23): a secondary button opening a BoMenu (managed collections, a divider, the system ones; the
// rows already in the table are disabled) instead of the VSelect with a button preview.
import { computed } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import { useCollections } from './use-collections.ts';
import { displayCollectionKey } from '../../../utils/display-collection-key.ts';

const props = defineProps<{
	excludeCollections?: string[];
}>();

const emit = defineEmits<{
	select: [string];
}>();

const { displayItems } = useCollections({ excludeCollections: () => props.excludeCollections || [] });

const menuItems = computed(() => {
	const items: BoMenuItem[] = [];

	for (const item of displayItems.value) {
		if (item.divider) {
			if (items.length > 0) items[items.length - 1]!.divider = true;
			continue;
		}

		items.push({
			text: displayCollectionKey(item.collection),
			disabled: !!item.disabled,
			onSelect: () => emit('select', item.collection),
		});
	}

	return items;
});
</script>

<template>
	<div>
		<BoMenu :items="menuItems">
			<template #trigger>
				<BoButton variant="secondary">
					{{ $t('permission_add_collection') }}
					<BoIcon name="arrow_drop_down" aria-hidden="true" />
				</BoButton>
			</template>
		</BoMenu>
	</div>
</template>
