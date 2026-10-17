<!-- Ported from directus/app/src/modules/settings/routes/flows/flow.vue (the "Copy To" dialog) -->
<script setup lang="ts">
// Backoffice (spec 017 FR-028, recipe Q-33): BoDialog with one BoSelect of the other flows; an info notice and a
// disabled confirm when there is none. Cancel first.
import type { FlowRaw } from '@directus/types';
import { computed } from 'vue';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoNotice from '../../../../../components/BoNotice.vue';
import BoSelect from '../../../../../components/BoSelect.vue';

const props = withDefaults(defineProps<{ open: boolean; flows: FlowRaw[]; loading?: boolean }>(), { loading: false });
const target = defineModel<string | undefined>('target');
const emit = defineEmits<{ cancel: []; confirm: [] }>();

const items = computed(() => props.flows.map((flow) => ({ text: flow.name, value: flow.id })));

const open = computed({
	get: () => props.open,
	set: (value: boolean) => {
		if (!value) emit('cancel');
	},
});
</script>

<template>
	<BoDialog v-model:open="open" :title="$t('copy_to')">
		<BoNotice v-if="flows.length === 0">{{ $t('no_other_flows_copy') }}</BoNotice>
		<BoSelect
			v-else
			:model-value="target ?? null"
			:label="$t('flow')"
			:items="items"
			@update:model-value="target = $event"
		/>

		<template #actions>
			<BoButton variant="secondary" @click="emit('cancel')">{{ $t('cancel') }}</BoButton>
			<BoButton :disabled="flows.length === 0" :loading="loading" @click="emit('confirm')">
				{{ $t('copy') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
