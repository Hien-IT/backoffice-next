<!-- Ported from directus/app/src/modules/settings/routes/flows/components/logs-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice (spec 017 US4, FR-050 to FR-055, recipe Q-32): SidebarDetail of the detail panel (open when the sidebar
// store has `logs` active, as the revisions section of 014), BoProgressLinear, BoDetail per day, a toggle button with
// `aria-pressed`, BoPagination compact; the run rows are buttons with the status icon (resolve brand, other orange).
import type { FlowRaw } from '@directus/types';
import { abbreviateNumber } from '@directus/utils';
import { computed, onMounted, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoDetail from '../../../../../components/BoDetail.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoPagination from '../../../../../components/BoPagination.vue';
import BoProgressLinear from '../../../../../components/BoProgressLinear.vue';
import SidebarDetail from '../../../../../components/sidebar/SidebarDetail.vue';
import { useRevisions } from '../../../../../composables/use-revisions.ts';
import { useSidebarStore } from '../../../../../layout/stores/sidebar.ts';
import type { RevisionWithTime } from '../../../../../types/revisions.ts';
import LogsDrawer from './LogsDrawer.vue';

const props = defineProps<{
	flow: FlowRaw;
}>();

const { flow } = toRefs(props);

const { t } = useI18n();

const title = computed(() => t('logs'));

const sidebarStore = useSidebarStore();

const page = ref<number>(1);
const selectedRevision = ref<RevisionWithTime | null>(null);
const showFailedOnly = ref(false);

const { revisionsByDate, getRevisions, revisionsCount, getRevisionsCount, loading, loadingCount, pagesCount, refresh } =
	useRevisions(
		ref('directus_flows'),
		computed(() => unref(flow).id),
		ref(null),
		{
			action: 'run', // Action.RUN of @directus/constants
			full: true,
		},
	);

watch([() => page.value, () => showFailedOnly.value], async () => {
	await refresh(page.value);
	if (showFailedOnly.value) filterRevisions();
});

function filterRevisions() {
	if (!revisionsByDate.value) return;

	revisionsByDate.value = revisionsByDate.value
		.map((group) => ({
			...group,
			revisions: group.revisions.filter((r) => r.status === 'reject'),
		}))
		.filter((group) => group.revisions.length > 0);
}

onMounted(() => {
	getRevisionsCount();

	if (sidebarStore.activeAccordionItem === 'logs') {
		getRevisions();
	}
});

function onToggle(open: boolean) {
	if (open && revisionsByDate.value === null) getRevisions();
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<SidebarDetail
		id="logs"
		:title
		icon="fact_check"
		:badge="!loadingCount && revisionsCount > 0 ? abbreviateNumber(revisionsCount) : false"
		@toggle="onToggle"
	>
		<BoProgressLinear v-if="!revisionsByDate && loading" indeterminate :aria-label="$t('loading')" class="my-5" />

		<p v-else-if="revisionsCount === 0" class="my-3 italic">{{ $t('no_logs') }}</p>

		<template v-else>
			<button
				type="button"
				class="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
				:class="FOCUS"
				:aria-pressed="showFailedOnly"
				@click="showFailedOnly = !showFailedOnly"
			>
				<BoIcon
					:name="showFailedOnly ? 'cancel' : 'circle'"
					size="sm"
					:class="showFailedOnly ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400'"
				/>
				{{ $t('show_failed_only') }}
			</button>

			<p v-if="!revisionsByDate?.length" class="my-3 italic">{{ $t('no_logs_on_page') }}</p>

			<BoDetail
				v-for="group in revisionsByDate"
				:key="group.dateFormatted"
				:title="group.dateFormatted"
				:model-value="true"
				class="mt-2"
			>
				<ul class="m-0 flex list-none flex-col p-0" data-flow-log>
					<li v-for="revision in group.revisions" :key="revision.id">
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
							:class="FOCUS"
							:data-status="revision.status"
							@click="selectedRevision = revision"
						>
							<BoIcon
								v-if="revision.status === 'resolve'"
								name="check_circle"
								size="sm"
								class="text-brand-500 dark:text-brand-400"
								:label="$t('success')"
							/>
							<BoIcon
								v-else
								name="cancel"
								size="sm"
								class="text-orange-500 dark:text-orange-400"
								:label="$t('flow_run_failed')"
							/>
							{{ revision.timeRelative }}
						</button>
					</li>
				</ul>
			</BoDetail>
		</template>

		<BoPagination
			v-if="pagesCount > 1"
			v-model="page"
			class="mt-5 justify-center"
			:length="pagesCount"
			:total-visible="3"
			:show-first-last="false"
			:label="title"
		/>
	</SidebarDetail>

	<LogsDrawer :flow="flow" :revision="selectedRevision" @close="selectedRevision = null" />
</template>
