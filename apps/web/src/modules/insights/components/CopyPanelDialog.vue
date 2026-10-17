<!-- Ported from directus/app/src/modules/insights/routes/dashboard.vue (Copy To dialog) -->
<script setup lang="ts">
// Backoffice (spec 018 FR-026): VDialog -> BoDialog, VSelect -> BoSelect, VNotice -> BoNotice. The copy is a staged
// duplicate on the chosen dashboard (stagePanelDuplicate), saved with the current dashboard, as Directus.
import { computed, ref, watch } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { useInsightsStore } from '../../../stores/insights.ts';

const props = defineProps<{ dashboard: string }>();

/** The panel being copied; null closes the dialog. */
const panelId = defineModel<string | null>({ default: null });

const insightsStore = useInsightsStore();

const copyPanelChoices = computed(() =>
	insightsStore.dashboards.filter((dashboard) => dashboard.id !== props.dashboard),
);

const copyPanelTo = ref<string | null>(copyPanelChoices.value[0]?.id ?? null);

watch(panelId, (id) => {
	if (id) copyPanelTo.value ??= copyPanelChoices.value[0]?.id ?? null;
});

const open = computed({
	get: () => !!panelId.value,
	set: (value: boolean) => {
		if (!value) panelId.value = null;
	},
});

function copyPanel() {
	if (!copyPanelChoices.value.length || !panelId.value) return;

	insightsStore.stagePanelDuplicate(panelId.value, { dashboard: copyPanelTo.value! });
	panelId.value = null;
}
</script>

<template>
	<BoDialog v-model:open="open" :title="$t('copy_to')">
		<BoNotice v-if="!copyPanelChoices.length">{{ $t('no_other_dashboards_copy') }}</BoNotice>
		<BoSelect
			v-else
			v-model="copyPanelTo"
			:label="$t('copy_to')"
			:items="copyPanelChoices.map((dashboard) => ({ text: dashboard.name, value: dashboard.id }))"
		/>

		<template #actions>
			<BoButton variant="secondary" @click="panelId = null">{{ $t('cancel') }}</BoButton>
			<BoButton :disabled="!copyPanelChoices.length" @click="copyPanel">{{ $t('copy') }}</BoButton>
		</template>
	</BoDialog>
</template>
