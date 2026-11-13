<script setup lang="ts">
// Backoffice (spec 032, contracts/web.md "Chi tiết dòng", FR-011): the values of one row, source next to target per
// field; a row on one side only shows that side. Not ComparisonModal (bound to an item and its versions, research R12).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import type { SyncRow } from '../types.ts';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ row: SyncRow | null }>();

const { t } = useI18n();

const show = (value: unknown) =>
	value === undefined || value === null ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);

const single = computed(() => {
	const row = props.row;
	if (!row || row.changes?.length) return null;
	if (row.state === 'source_only') return { side: t('sync_source'), value: row.source };
	if (row.state === 'target_only') return { side: t('sync_target'), value: row.target };
	return null;
});
</script>

<template>
	<BoDialog
		v-model:open="open"
		:title="row?.label ?? ''"
		v-bind="row ? { description: t(`sync_state_${row.state}`) } : {}"
	>
		<div v-if="row" class="max-h-[60vh] overflow-auto">
			<table v-if="row.changes?.length" class="w-full border-collapse text-left text-sm">
				<caption class="sr-only">{{ row.label }}</caption>
				<thead>
					<tr class="border-b border-gray-200 dark:border-gray-800">
						<th scope="col" class="py-2 pe-3 font-medium text-gray-500 dark:text-gray-400">{{ t('sync_field') }}</th>
						<th scope="col" class="py-2 pe-3 font-medium text-gray-500 dark:text-gray-400">{{ t('sync_source') }}</th>
						<th scope="col" class="py-2 font-medium text-gray-500 dark:text-gray-400">{{ t('sync_target') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="change in row.changes"
						:key="change.path"
						class="border-b border-gray-100 align-top dark:border-gray-800"
					>
						<th scope="row" class="py-2 pe-3 font-mono text-xs font-normal text-gray-700 dark:text-gray-300">
							{{ change.path }}
						</th>
						<td class="py-2 pe-3">
							<pre class="m-0 font-mono text-xs whitespace-pre-wrap text-gray-800 dark:text-white/90">{{
								show(change.source)
							}}</pre>
						</td>
						<td class="py-2">
							<pre class="m-0 font-mono text-xs whitespace-pre-wrap text-gray-800 dark:text-white/90">{{
								show(change.target)
							}}</pre>
						</td>
					</tr>
				</tbody>
			</table>

			<template v-else-if="single">
				<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
					{{ t('sync_missing_other_side', { side: single.side }) }}
				</p>
				<pre
					class="m-0 rounded-lg bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap text-gray-800 dark:bg-white/5 dark:text-white/90"
					>{{ show(single.value) }}</pre
				>
			</template>

			<p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t(row.reason ?? 'sync_state_same') }}</p>
		</div>

		<template #actions>
			<BoButton variant="secondary" @click="open = false">{{ t('done') }}</BoButton>
		</template>
	</BoDialog>
</template>
