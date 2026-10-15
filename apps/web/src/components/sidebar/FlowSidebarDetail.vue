<!-- Ported from directus/app/src/views/private/components/flow-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-9, one secondary BoButton per manual flow (`w-full justify-start`), the flow color as a data
// color on its icon instead of the Directus button background; the tooltip sits on a wrapper because a disabled
// button gets no pointer events.
import BoButton from '../BoButton.vue';
import BoIcon from '../BoIcon.vue';
import BoTooltip from '../BoTooltip.vue';
import { type ManualFlow, useInjectRunManualFlow } from '../../composables/use-run-manual-flow.ts';
import SidebarDetail from './SidebarDetail.vue';

defineProps<{
	manualFlows: ManualFlow[];
}>();

const { runManualFlow, runningFlows } = useInjectRunManualFlow();
</script>

<template>
	<SidebarDetail v-if="manualFlows.length > 0" id="flows" icon="bolt" :title="$t('flows')">
		<div class="flex flex-col gap-3.5 pb-1">
			<BoTooltip v-for="manualFlow in manualFlows" :key="manualFlow.id" :text="manualFlow.tooltip">
				<div>
					<BoButton
						variant="secondary"
						full-width
						class="justify-start"
						:loading="runningFlows.includes(manualFlow.id)"
						:disabled="manualFlow.isFlowDisabled"
						@click="runManualFlow(manualFlow.id)"
					>
						<BoIcon
							v-if="!runningFlows.includes(manualFlow.id)"
							:name="manualFlow.icon ?? 'bolt'"
							size="sm"
							:style="manualFlow.color ? { color: manualFlow.color } : undefined"
						/>
						{{ manualFlow.name }}
					</BoButton>
				</div>
			</BoTooltip>
		</div>
	</SidebarDetail>
</template>
