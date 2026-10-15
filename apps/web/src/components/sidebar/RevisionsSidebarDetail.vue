<!-- Ported from directus/app/src/views/private/components/revisions-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-10 and Q-9; the section is open when `sidebarStore.activeAccordionItem` is `revisions`
// (Directus also reads useGroupable). BoPagination is the compact one (3 pages, no first/last).
import type { PrimaryKey } from '@directus/types';
import { abbreviateNumber } from '@directus/utils';
import { computed, onMounted, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useRevisions } from '../../composables/use-revisions.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import type { Revision } from '../../types/revisions.ts';
import type { ContentVersionMaybeNew, ContentVersionWithType } from '../../types/versions.ts';
import BoPagination from '../BoPagination.vue';
import BoProgressLinear from '../BoProgressLinear.vue';
import ComparisonModal from '../comparison/ComparisonModal.vue';
import RevisionsDateGroup from './RevisionsDateGroup.vue';
import SidebarDetail from './SidebarDetail.vue';

const props = defineProps<{
	collection: string;
	primaryKey: PrimaryKey;
	version?: ContentVersionMaybeNew | null;
}>();

defineEmits(['revert']);

const { t } = useI18n();

const title = computed(() => t('revisions'));

const { collection, primaryKey, version } = toRefs(props);

const sidebarStore = useSidebarStore();
const route = useRoute();

const comparisonModalActive = ref(false);
const currentRevision = ref<Revision | null>(null);
const page = ref<number>(1);

const comparableVersion = computed(() => {
	if (version.value === undefined || version.value === null) return version.value;
	if (version.value.id === '+') return undefined;
	return version.value as ContentVersionWithType;
});

const {
	revisions,
	revisionsByDate,
	loading,
	refresh,
	revisionsCount,
	pagesCount,
	created,
	getRevisions,
	loadingCount,
	getRevisionsCount,
} = useRevisions(collection, primaryKey, comparableVersion, { full: true });

onMounted(() => {
	getRevisionsCount();

	if (sidebarStore.activeAccordionItem === 'revisions') {
		getRevisions();
	}
});

watch(
	() => page.value,
	(newPage) => {
		refresh(newPage);
	},
);

watch(() => route?.fullPath, closeModal);

function openModal(id: number) {
	currentRevision.value = (revisions.value as Revision[])?.find((revision) => revision.id === id) ?? null;
	comparisonModalActive.value = true;
}

function closeModal() {
	comparisonModalActive.value = false;
	currentRevision.value = null;
}

function onToggle(open: boolean) {
	if (open && revisions.value === null) getRevisions();
}

defineExpose({
	refresh,
});
</script>

<template>
	<SidebarDetail
		id="revisions"
		:title
		icon="change_history"
		:badge="!loadingCount && revisionsCount > 0 ? abbreviateNumber(revisionsCount) : false"
		@toggle="onToggle"
	>
		<BoProgressLinear v-if="!revisions && loading" indeterminate :aria-label="$t('loading')" class="my-5" />

		<p v-else-if="revisionsCount === 0" class="my-3 italic">{{ $t('no_revisions') }}</p>

		<template v-else>
			<RevisionsDateGroup
				v-for="group in revisionsByDate"
				:key="group.date.toString()"
				:group="group"
				@click="openModal"
			/>

			<p
				v-if="page == pagesCount && !created"
				class="mt-5 px-2 italic"
				:class="{ 'border-t border-gray-200 pt-2 dark:border-gray-800': revisionsByDate!.length > 0 }"
			>
				{{ $t('revision_delta_created_externally') }}
			</p>

			<BoPagination
				v-if="pagesCount > 1"
				v-model="page"
				class="mt-5 justify-center"
				:length="pagesCount"
				:total-visible="3"
				:show-first-last="false"
				:label="title"
			/>
		</template>

		<ComparisonModal
			v-model="comparisonModalActive"
			v-model:current-revision="currentRevision"
			:delete-versions-allowed="false"
			:collection
			:primary-key
			mode="revision"
			:current-version="comparableVersion"
			:revisions="revisions as Revision[]"
			@confirm="$emit('revert', $event)"
			@cancel="closeModal"
		/>
	</SidebarDetail>
</template>
