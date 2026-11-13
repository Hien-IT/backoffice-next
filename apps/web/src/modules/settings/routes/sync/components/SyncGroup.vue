<script setup lang="ts">
// Backoffice (spec 032, contracts/web.md "Bảng so sánh và chọn", FR-009, FR-010, FR-016, FR-018, Q-49): one group as a
// collapsible block with a table. BoTable keeps showSelect "none": the tick column is drawn in a slot because each row
// can be blocked on its own; the header tick selects creates and updates only (never a delete).
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoCheckbox from '../../../../../components/BoCheckbox.vue';
import BoChip from '../../../../../components/BoChip.vue';
import BoDetail from '../../../../../components/BoDetail.vue';
import BoTable, { type BoTableColumn } from '../../../../../components/BoTable.vue';
import type { GroupKey, SyncRow } from '../types.ts';
import { groupTickable, tickable } from '../use-sync.ts';

const props = defineProps<{
	group: GroupKey;
	rows: SyncRow[];
	all: SyncRow[];
	selected: Set<string>;
	state: 'all' | 'some' | 'none';
	isLocked: (row: SyncRow) => boolean;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	toggle: [row: SyncRow, checked: boolean];
	toggleGroup: [checked: boolean];
	open: [row: SyncRow];
}>();

const { t } = useI18n();
const open = ref(true);

const counts = computed(() => {
	const by = (state: SyncRow['state']) => props.all.filter((r) => r.state === state).length;
	return { changed: by('changed'), source_only: by('source_only'), target_only: by('target_only') };
});

const title = computed(
	() =>
		`${t(`sync_group_${props.group}`)} · ${t('sync_counts', {
			changed: counts.value.changed,
			source: counts.value.source_only,
			target: counts.value.target_only,
		})}`,
);

const columns = computed<BoTableColumn[]>(() => [
	{ key: 'select', label: t('sync_select'), width: 56, sortable: false },
	{ key: 'label', label: t('name'), sortable: false },
	{ key: 'kind', label: t('type'), width: 160, sortable: false },
	{ key: 'state', label: t('status'), width: 170, sortable: false },
	{ key: 'reason', label: t('sync_note'), sortable: false },
]);

const hasGroupTick = computed(() => props.all.some(groupTickable));

const chip: Record<SyncRow['state'], string> = {
	same: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300',
	changed: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	source_only: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500',
	target_only: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500',
};

const lockedNote = (row: SyncRow) => (props.isLocked(row) ? t('sync_deleted_with') : '');
</script>

<template>
	<BoDetail v-model="open" :title="title" :disabled="false">
		<p v-if="rows.length === 0" class="px-1 py-3 text-sm text-gray-500 dark:text-gray-400">{{ t('sync_no_rows') }}</p>
		<BoTable v-else :columns="columns" :rows="rows" row-key="id" show-select="none" :caption="t(`sync_group_${group}`)">
			<template #[`header.select`]>
				<BoCheckbox
					:model-value="state === 'all'"
					:indeterminate="state === 'some'"
					:disabled="disabled || !hasGroupTick"
					:aria-label="t('sync_select_group', { group: t(`sync_group_${group}`) })"
					@update:model-value="emit('toggleGroup', $event === true)"
				/>
			</template>

			<template #[`item.select`]="{ item }">
				<BoCheckbox
					v-if="(item as SyncRow).state !== 'same'"
					:model-value="selected.has((item as SyncRow).id)"
					:disabled="disabled || !tickable(item as SyncRow) || isLocked(item as SyncRow)"
					:aria-label="t('sync_select_row', { name: (item as SyncRow).label })"
					@update:model-value="emit('toggle', item as SyncRow, $event === true)"
				/>
			</template>

			<template #[`item.label`]="{ item }">
				<button
					type="button"
					class="cursor-pointer rounded text-left text-sm font-medium text-gray-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90"
					@click="emit('open', item as SyncRow)"
				>
					{{ (item as SyncRow).label }}
				</button>
			</template>

			<template #[`item.kind`]="{ item }">{{ t(`sync_kind_${(item as SyncRow).kind}`) }}</template>

			<template #[`item.state`]="{ item }">
				<BoChip size="sm" :text="t(`sync_state_${(item as SyncRow).state}`)" :class="chip[(item as SyncRow).state]" />
			</template>

			<template #[`item.reason`]="{ item }">
				<span class="text-sm text-gray-500 dark:text-gray-400">
					{{ (item as SyncRow).reason ? t((item as SyncRow).reason!) : lockedNote(item as SyncRow) }}
				</span>
			</template>
		</BoTable>
	</BoDetail>
</template>
