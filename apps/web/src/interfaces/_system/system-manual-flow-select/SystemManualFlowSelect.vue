<!-- Ported from directus/app/src/interfaces/_system/system-manual-flow-select/system-manual-flow-select.vue -->
<script setup lang="ts">
// Backoffice: VSelect is BoSelect (the flow icon before its name, `showDeselect`); BoSelect has no item color, so the
// flow color is not shown.
import type { FlowRaw } from '@directus/types';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useFlowsStore } from '../../../stores/flows.ts';

const props = defineProps<{ value: string | null; collectionName: string }>();
const emit = defineEmits<{ input: [value: string | null] }>();

const a11y = inject(FORM_FIELD_A11Y, null);
const flowsStore = useFlowsStore();

const { t } = useI18n();

const flows = computed(() =>
	flowsStore.flows
		.filter(
			(flow: FlowRaw) =>
				flow.trigger === 'manual' &&
				flow.options &&
				flow.options['collections'] &&
				flow.options['collections'].includes(props.collectionName) &&
				flow.options['location'] !== 'collection',
		)
		.map((flow: FlowRaw) => ({
			value: flow.id,
			text: `${flow.name}${(flow.description && ': ' + flow.description) || ''}${flow.status === 'inactive' ? ` (${t('inactive')})` : ''}`,
			...(flow.icon ? { icon: flow.icon } : {}),
		})),
);
</script>

<template>
	<BoSelect
		v-bind="a11y?.inputId ? { id: a11y.inputId } : {}"
		:model-value="value"
		:items="flows"
		show-deselect
		:placeholder="$t('select_a_flow')"
		@update:model-value="emit('input', $event)"
		@deselect="emit('input', null)"
	/>
</template>
