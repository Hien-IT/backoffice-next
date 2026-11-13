<script setup lang="ts">
// Backoffice (spec 032, contracts/web.md "Áp dụng", FR-030, FR-025): what an apply did per group, the names deleted,
// the indexes built after the commit, and the steps after the commit that failed (the data stays written).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoNotice from '../../../../../components/BoNotice.vue';
import { GROUP_KEYS, type SyncResult } from '../types.ts';

const props = defineProps<{ result: SyncResult }>();
const { t } = useI18n();

const perGroup = computed(() =>
	GROUP_KEYS.map((group) => ({
		group,
		created: props.result.created[group] ?? 0,
		updated: props.result.updated[group] ?? 0,
		deleted: props.result.deleted[group] ?? 0,
	})).filter((g) => g.created + g.updated + g.deleted > 0),
);
</script>

<template>
	<section role="status" class="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
		<h2 class="m-0 text-base font-semibold text-gray-800 dark:text-white/90">{{ t('sync_result_title') }}</h2>

		<ul class="m-0 list-none space-y-1 p-0 text-sm text-gray-700 dark:text-gray-300">
			<li v-for="g in perGroup" :key="g.group">
				<span class="font-medium">{{ t(`sync_group_${g.group}`) }}:</span>
				{{ t('sync_confirm_counts', { created: g.created, updated: g.updated, deleted: g.deleted }) }}
			</li>
			<li v-if="perGroup.length === 0">{{ t('sync_result_nothing') }}</li>
		</ul>

		<div v-if="result.deletedLabels.length > 0" class="text-sm text-gray-700 dark:text-gray-300">
			<span class="font-medium">{{ t('sync_result_deleted') }}</span>
			{{ result.deletedLabels.join(', ') }}
		</div>

		<div v-if="result.indexes.length > 0" class="text-sm text-gray-700 dark:text-gray-300">
			<span class="font-medium">{{ t('sync_result_indexes') }}</span>
			<ul class="m-0 list-disc ps-5">
				<li v-for="ix in result.indexes" :key="`${ix.collection}.${ix.name}`">
					{{ ix.collection }} · {{ ix.name }}: {{ t(`sync_index_${ix.status}`) }}
					<span v-if="ix.error">({{ ix.error }})</span>
				</li>
			</ul>
		</div>

		<BoNotice v-for="w in result.warnings" :key="w" type="warning">
			{{ t('sync_post_commit_warning', { step: w }) }}
		</BoNotice>
	</section>
</template>
