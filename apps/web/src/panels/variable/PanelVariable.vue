<!-- Ported from directus/app/src/panels/variable/panel-variable.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-051, FR-052, FR-055, FR-056): the interface comes from the registry (getInterface) instead
// of the global `interface-${inter}` component; the padding is PanelTile's. The interface is labelled by the tile
// label (PANEL_LABEL) through FORM_FIELD_A11Y, as FormField labels it (Directus has no label: a11y).
import type { Type } from '@directus/types';
import { computed, inject, provide, ref, useId } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { getInterface } from '../../interfaces/index.ts';
import { useInsightsStore } from '../../stores/insights.ts';
import { PANEL_LABEL } from '../shared/panel-label.ts';

interface Props {
	type: Type;
	field: string;
	inter: string;
	dashboard: string;
	width: number;
	options?: Record<string, any>;
	showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), { options: () => ({}) });

const insightsStore = useInsightsStore();

const fieldWidth = computed(() => (props.width < 20 ? 'half' : 'full'));

const value = computed({
	get() {
		return insightsStore.getVariable(props.field);
	},
	set(val: any) {
		insightsStore.setVariable(props.field, val);
	},
});

const component = computed(() => getInterface(props.inter)?.component ?? null);

const panelLabel = inject(PANEL_LABEL, ref(''));
const inputId = useId();
const labelId = useId();
provide(
	FORM_FIELD_A11Y,
	computed(() => ({ inputId, labelId, describedBy: undefined, invalid: false })),
);
</script>

<template>
	<div class="variable grid h-full w-full content-center" :class="{ 'show-header': showHeader }">
		<label :id="labelId" :for="inputId" class="sr-only">{{ panelLabel || field }}</label>
		<component
			:is="component"
			v-if="component"
			v-bind="options"
			:value="value"
			:width="fieldWidth"
			:type="type"
			:field="field"
			@input="value = $event"
		/>
	</div>
</template>
