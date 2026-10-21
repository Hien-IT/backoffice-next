<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoRemove (extended with `button`, the round filled button). The icon,
// tooltip text and confirmation rule are the v-remove ones (getRemoveAction); the attrs reach the button.
import BoRemove from '../../components/BoRemove.vue';
import type { RelationM2A } from '../../composables/use-relation-m2a.ts';
import type { RelationM2M } from '../../composables/use-relation-m2m.ts';
import type { RelationM2O } from '../../composables/use-relation-m2o.ts';
import type { DisplayItem } from '../../composables/use-relation-multiple.ts';
import type { RelationO2M } from '../../composables/use-relation-o2m.ts';

defineProps<{
	itemType?: DisplayItem['$type'];
	itemInfo?: RelationM2O | RelationO2M | RelationM2M | RelationM2A;
	itemIsLocal?: boolean;
	itemEdits?: DisplayItem;
	deselect?: boolean;
	disabled?: boolean;
	button?: boolean;
	confirm?: boolean;
}>();

const emit = defineEmits(['action']);
</script>

<template>
	<BoRemove v-bind="$props" @action="emit('action', $event)" />
</template>
