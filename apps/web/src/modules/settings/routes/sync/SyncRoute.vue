<script setup lang="ts">
// Backoffice (spec 032, D-214.1, contracts/web.md, recipe Q-49): Settings > Environment Sync. One screen compares and
// selects: connect form, the rows per group with a state filter, a confirm dialog, the result. Hidden when the API is DR
// (the probe of useEnvironmentSync answers 404 there): the page shows the Settings not-found page.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../components/BoButton.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoTabs from '../../../../components/BoTabs.vue';
import { useEnvironmentSync } from '../../../../composables/use-environment-sync.ts';
import { notify } from '../../../../composables/use-notices.ts';
import { translateAPIError } from '../../../../lang/index.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useSettingsStore } from '../../../../stores/settings.ts';
import ContentNotFound from '../../../content/routes/ContentNotFound.vue';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import SyncConfirmDialog from './components/SyncConfirmDialog.vue';
import SyncConnectForm from './components/SyncConnectForm.vue';
import SyncGroup from './components/SyncGroup.vue';
import SyncResult from './components/SyncResult.vue';
import SyncRowDetail from './components/SyncRowDetail.vue';
import { GROUP_KEYS, type StateFilter, type SyncRow } from './types.ts';
import { reasonMessage, useSync } from './use-sync.ts';

const { t } = useI18n();
const { available, ready } = useEnvironmentSync();
const probed = ref(false);
ready.then(() => (probed.value = true));

const sync = useSync();
const { url, token, groups, phase, error, compared, rows, selected, selectedRows, result, filter } = sync;

const detail = ref<SyncRow | null>(null);
const detailOpen = ref(false);
const confirmOpen = ref(false);

const busy = computed(() => phase.value === 'comparing' || phase.value === 'applying');

const errorText = computed(() => {
	if (!error.value) return '';
	const reason = error.value.errors?.[0]?.extensions?.reason;
	const known = reasonMessage(reason);
	return known ? t(known.key, known.params ?? {}) : (reason ?? translateAPIError(error.value as never));
});

const stale = computed(
	() => error.value?.errors?.[0]?.extensions?.reason === 'The comparison is out of date, compare again',
);

const count = (state: StateFilter) =>
	rows.value.filter((r) => (state === 'all' ? true : state === 'changes' ? r.state !== 'same' : r.state === state))
		.length;

const tabs = computed(() =>
	(['changes', 'changed', 'source_only', 'target_only', 'all'] as StateFilter[]).map((value) => ({
		value,
		label: `${t(`sync_filter_${value}`)} (${count(value)})`,
	})),
);

const shownGroups = computed(() => GROUP_KEYS.filter((g) => compared.value?.groups.includes(g)));

function openRow(row: SyncRow) {
	detail.value = row;
	detailOpen.value = true;
}

async function confirm() {
	await sync.apply();
	confirmOpen.value = false;

	if (phase.value === 'done') {
		notify({ title: t('sync_applied'), type: 'success' });
		// The stores read what the apply changed, as after a manual edit.
		await Promise.allSettled([
			useCollectionsStore().hydrate(),
			useFieldsStore().hydrate(),
			useRelationsStore().hydrate(),
			useSettingsStore().hydrate(),
			usePermissionsStore().hydrate(),
			useFlowsStore().hydrate(),
		]);
	}
}
</script>

<template>
	<ContentNotFound v-if="probed && !available" module="settings" />

	<PrivateView
		v-else
		:title="$t('settings_sync')"
		icon="sync_alt"
		:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
	>
		<template #navigation>
			<SettingsNavigation />
		</template>

		<template v-if="phase === 'compared' || phase === 'applying'" #actions>
			<BoButton icon="check" :disabled="selected.size === 0 || busy" @click="confirmOpen = true">
				{{ t('sync_apply_count', { count: selected.size }) }}
			</BoButton>
		</template>

		<div class="flex max-w-6xl flex-col gap-6">
			<p class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ t('sync_copy') }}</p>

			<SyncConnectForm
				v-model:url="url"
				v-model:token="token"
				v-model:groups="groups"
				:busy="busy"
				@compare="sync.compare()"
			/>

			<BoNotice v-if="error" type="danger">
				<span>{{ errorText }}</span>
				<BoButton v-if="stale" class="ms-3" variant="secondary" size="sm" @click="sync.compare()">
					{{ t('sync_compare_again') }}
				</BoButton>
			</BoNotice>

			<SyncResult v-if="phase === 'done' && result" :result="result" />

			<div v-if="phase === 'done'">
				<BoButton variant="secondary" icon="refresh" @click="sync.compare()">{{ t('sync_compare_again') }}</BoButton>
			</div>

			<section v-if="compared && phase !== 'done'" :aria-busy="busy || undefined" class="flex flex-col gap-4">
				<p class="m-0 text-sm text-gray-500 dark:text-gray-400">
					{{ t('sync_source_info', { version: compared.source.backoffice, vendor: compared.source.vendor }) }}
				</p>

				<BoTabs v-model="filter" :items="tabs" :label="t('sync_filter')">
					<template #content>
						<div class="flex flex-col gap-4 pt-4">
							<SyncGroup
								v-for="group in shownGroups"
								:key="group"
								:group="group"
								:rows="rows.filter((r) => r.group === group && sync.visible(r))"
								:all="rows.filter((r) => r.group === group)"
								:selected="selected"
								:state="sync.groupState(group)"
								:is-locked="sync.isLocked"
								:disabled="busy"
								@toggle="sync.toggle"
								@toggle-group="sync.toggleGroup(group, $event)"
								@open="openRow"
							/>
						</div>
					</template>
				</BoTabs>
			</section>
		</div>

		<SyncRowDetail v-model:open="detailOpen" :row="detail" />
		<SyncConfirmDialog
			v-model:open="confirmOpen"
			:rows="selectedRows"
			:busy="phase === 'applying'"
			@confirm="confirm"
		/>
	</PrivateView>
</template>
