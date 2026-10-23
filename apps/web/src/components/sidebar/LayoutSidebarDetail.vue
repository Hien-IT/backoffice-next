<!-- Ported from directus/app/src/views/private/components/layout-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: layouts come from the registry of src/layouts (getLayouts) instead of useExtensions; the icon of the
// current layout shows through the BoSelect item icon; the form grid is a vertical stack of the panel (recipe Q-9).
import { computed } from 'vue';
import { getLayout, getLayouts } from '../../layouts/index.ts';
import { translate } from '../../utils/translate-object-values.ts';
import BoSelect from '../BoSelect.vue';
import SidebarDetail from './SidebarDetail.vue';

const props = defineProps<{
	modelValue: string | null;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const layouts = computed(() =>
	getLayouts().map((layout) => ({ text: translate(layout.name), value: layout.id, icon: layout.icon })),
);

const layout = computed({
	get() {
		// Backoffice: an unknown layout id shows the tabular fallback, like currentLayout of DR.
		return getLayout(props.modelValue ?? 'tabular') ? (props.modelValue ?? 'tabular') : 'tabular';
	},
	set(value) {
		emit('update:modelValue', value);
	},
});
</script>

<template>
	<SidebarDetail id="layout" icon="layers" :title="$t('layout_options')">
		<div class="flex flex-col gap-4.5 pb-1">
			<BoSelect v-model="layout" :label="$t('layout')" :items="layouts" />

			<slot />
		</div>
	</SidebarDetail>
</template>
