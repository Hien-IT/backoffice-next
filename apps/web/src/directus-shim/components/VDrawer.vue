<!-- Ported from directus/app/src/components/v-drawer.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #39): v-drawer on BoDrawer, which is already its port (v-drawer-header folded
// in, same slots and emits; extended with `sidebarLabel`). Every slot is forwarded. An unset `applyShortcut` takes the
// BoDrawer default meta+enter, as v-dialog does in Directus. Not honoured: `sidebarResizeable` (the BoDrawer sidebar is
// a fixed 240 px panel on the end side, 014 FR-029).
import BoDrawer from '../../components/drawers/BoDrawer.vue';

interface Props {
	title: string;
	subtitle?: string | null;
	modelValue?: boolean | undefined;
	persistent?: boolean;
	icon?: string;
	/**
	 * Color of the icon displayed in the drawer header.
	 */
	iconColor?: string | undefined;
	sidebarResizeable?: boolean;
	sidebarLabel?: string | undefined;
	cancelable?: boolean;
	applyShortcut?: 'meta+enter' | 'meta+s' | undefined;
}

withDefaults(defineProps<Props>(), {
	subtitle: null,
	modelValue: undefined,
	persistent: false,
	icon: 'box',
	iconColor: undefined,
	sidebarLabel: undefined,
	cancelable: true,
	applyShortcut: undefined,
});

defineEmits(['cancel', 'apply', 'update:modelValue']);
</script>

<template>
	<BoDrawer
		:title="title"
		:subtitle="subtitle"
		:model-value="modelValue"
		:persistent="persistent"
		:icon="icon"
		:icon-color="iconColor"
		:cancelable="cancelable"
		v-bind="applyShortcut ? { applyShortcut } : {}"
		:sidebar-label="sidebarLabel"
		@cancel="$emit('cancel')"
		@apply="$emit('apply')"
		@update:model-value="$emit('update:modelValue', $event)"
	>
		<template v-for="(_, name) in $slots" #[name]="scope">
			<slot :name="name" v-bind="scope ?? {}" />
		</template>
	</BoDrawer>
</template>
