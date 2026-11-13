<script setup lang="ts">
// Backoffice (spec 032, contracts/web.md "Áp dụng", FR-021): what the apply will do, before it runs: counts per group,
// every collection, field and row deleted (with the rows deleted along), what a delete takes with it, the flows that
// start at once, and that a delete cannot be undone. Cancel sends nothing.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoNotice from '../../../../../components/BoNotice.vue';
import { GROUP_KEYS, type SyncRow } from '../types.ts';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ rows: SyncRow[]; busy?: boolean }>();
const emit = defineEmits<{ confirm: [] }>();

const { t } = useI18n();

const perGroup = computed(() =>
	GROUP_KEYS.map((group) => {
		const list = props.rows.filter((r) => r.group === group);
		return {
			group,
			created: list.filter((r) => r.state === 'source_only').length,
			updated: list.filter((r) => r.state === 'changed').length,
			deleted: list.filter((r) => r.state === 'target_only').length,
		};
	}).filter((g) => g.created + g.updated + g.deleted > 0),
);

const ids = computed(() => new Set(props.rows.map((r) => r.id)));

/** Deleted rows that are not themselves deleted along with another one, with the rows they take along. */
const deletes = computed(() => {
	const dels = props.rows.filter((r) => r.state === 'target_only');
	const along = new Set(dels.flatMap((r) => r.cascade));
	return dels
		.filter((r) => !along.has(r.id))
		.map((r) => ({ row: r, along: dels.filter((d) => r.cascade.includes(d.id) && ids.value.has(d.id)) }));
});

const activeFlows = computed(() =>
	props.rows.filter((r) => r.kind === 'flow' && r.state !== 'target_only' && r.impact?.active),
);

const impact = (row: SyncRow) => {
	const i = row.impact ?? {};
	if (i.items !== undefined) return t('sync_impact_items', { count: i.items }, i.items);
	if (i.users !== undefined) return t('sync_impact_users', { count: i.users }, i.users);
	if (i.permissions !== undefined) return t('sync_impact_permissions', { count: i.permissions }, i.permissions);
	if (i.files !== undefined) return t('sync_impact_files', { count: i.files }, i.files);
	return '';
};
</script>

<template>
	<BoDialog v-model:open="open" :title="t('sync_confirm_title')" :persistent="busy === true">
		<div class="flex max-h-[60vh] flex-col gap-4 overflow-auto text-sm text-gray-700 dark:text-gray-300">
			<ul class="m-0 list-none space-y-1 p-0">
				<li v-for="g in perGroup" :key="g.group">
					<span class="font-medium">{{ t(`sync_group_${g.group}`) }}:</span>
					{{ t('sync_confirm_counts', { created: g.created, updated: g.updated, deleted: g.deleted }) }}
				</li>
			</ul>

			<section v-if="deletes.length > 0">
				<h3 class="mb-1 text-sm font-semibold text-error-700 dark:text-error-500">{{ t('sync_confirm_delete') }}</h3>
				<ul class="m-0 list-disc space-y-1 ps-5">
					<li v-for="d in deletes" :key="d.row.id">
						<span class="font-medium">{{ t(`sync_kind_${d.row.kind}`) }}: {{ d.row.label }}</span>
						<span v-if="impact(d.row)" class="text-gray-500 dark:text-gray-400">· {{ impact(d.row) }}</span>
						<ul v-if="d.along.length > 0" class="mt-1 list-[circle] space-y-0.5 ps-5 text-gray-500 dark:text-gray-400">
							<li v-for="a in d.along" :key="a.id">
								{{ t('sync_deleted_along', { kind: t(`sync_kind_${a.kind}`), name: a.label }) }}
							</li>
						</ul>
					</li>
				</ul>
			</section>

			<section v-if="activeFlows.length > 0">
				<h3 class="mb-1 text-sm font-semibold">{{ t('sync_confirm_flows_active') }}</h3>
				<ul class="m-0 list-disc ps-5">
					<li v-for="f in activeFlows" :key="f.id">{{ f.label }}</li>
				</ul>
			</section>

			<BoNotice v-if="deletes.length > 0" type="danger">{{ t('sync_confirm_irreversible') }}</BoNotice>
		</div>

		<template #actions>
			<BoButton variant="secondary" :disabled="busy" @click="open = false">{{ t('cancel') }}</BoButton>
			<BoButton :variant="deletes.length > 0 ? 'danger' : 'primary'" :loading="busy" @click="emit('confirm')">
				{{ t('sync_apply') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
