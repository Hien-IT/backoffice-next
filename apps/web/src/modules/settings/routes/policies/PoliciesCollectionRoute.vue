<!-- Ported from directus/app/src/modules/settings/routes/policies/collection.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-4, recipes Q-2 and Q-27): BoTable with the Directus headers and requests; the create button
// is a BoButton link; the row menu is a BoMenu on a named `more_vert` icon button (an unnamed clickable icon in
// Directus); the duplicate dialog is a BoDialog with a form, so Enter duplicates (Directus `apply`), Cancel first.
// BoTextOverflow has no `highlight` yet, so the search match is marked here (v-highlight: every match, any case). The
// table is not `fixed-header` (it needs a bounded parent; the page scrolls). Errors open the error dialog (D-66).
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoDialog from '../../../../components/BoDialog.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import BoInput from '../../../../components/BoInput.vue';
import BoMenu from '../../../../components/BoMenu.vue';
import BoTable, { type BoTableColumn } from '../../../../components/BoTable.vue';
import SearchInput from '../../../../components/SearchInput.vue';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { fetchAll } from '../../../../utils/fetch-all.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';
import { type PolicyItem, useDuplicate } from './use-duplicate.ts';

type PolicyResponse = PolicyItem & {
	users: [{ count: { user: number } }];
	roles: [{ count: { role: number } }];
};

const { t } = useI18n();

const router = useRouter();

const policies = ref<PolicyItem[]>([]);
const loading = ref(false);

const duplicateDialogActive = ref(false);
const duplicateSource = ref<PolicyItem | null>(null);
const duplicateName = ref('');

const { duplicating, duplicate } = useDuplicate({
	source: duplicateSource,
	name: duplicateName,
	onSuccess: async () => {
		duplicateDialogActive.value = false;
		await fetchPolicies();
	},
});

const search = ref<string | null>(null);

const filteredPolicies = computed(() => {
	const normalizedSearch = search.value?.toLowerCase();
	if (!normalizedSearch) return policies.value;
	return policies.value.filter(
		(role) =>
			role.name?.toLowerCase().includes(normalizedSearch) || role.description?.toLowerCase().includes(normalizedSearch),
	);
});

const columns = ref<BoTableColumn[]>([
	{ label: '', key: 'icon', sortable: false, width: 42, align: 'left' },
	{ label: t('name'), key: 'name', sortable: false, width: 200, align: 'left' },
	{ label: t('users'), key: 'userCount', sortable: false, width: 100, align: 'left' },
	{ label: t('roles'), key: 'roleCount', sortable: false, width: 100, align: 'left' },
	{ label: t('description'), key: 'description', sortable: false, width: 470, align: 'left' },
]);

fetchPolicies();

const addNewLink = computed(() => {
	return `/settings/policies/+`;
});

async function fetchPolicies() {
	loading.value = true;

	// TODO since there might be a query limit enforced in the API we either need pagination or a fetch more
	try {
		const response = await fetchAll<PolicyResponse>(`/policies`, {
			params: {
				limit: -1,
				fields: [
					'id',
					'name',
					'icon',
					'description',
					'enforce_tfa',
					'ip_access',
					'app_access',
					'admin_access',
					'users',
					'roles',
				],
				deep: {
					users: {
						_aggregate: { count: 'user' },
						_groupBy: ['policy'],
						_sort: 'policy',
						_limit: -1,
					},
					roles: {
						_aggregate: { count: 'role' },
						_groupBy: ['policy'],
						_sort: 'policy',
						_limit: -1,
					},
				},
				sort: 'name',
			},
		});

		policies.value = response.map((policy) => {
			return {
				...translate(policy),
				userCount: policy.users?.[0]?.count.user ?? 0,
				roleCount: policy.roles?.[0]?.count.role ?? 0,
			};
		});

		policies.value.sort((a, b) => {
			return a.name.localeCompare(b.name);
		});
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		loading.value = false;
	}
}

function navigateToPolicy({ item }: { item: Record<string, any> }) {
	router.push({ name: 'settings-policies-item', params: { primaryKey: item['id'] } });
}

function openDuplicateDialog(item: PolicyItem) {
	duplicateSource.value = item;
	duplicateName.value = `${item.name} (copy)`;
	duplicateDialogActive.value = true;
}

/** v-highlight: the text split around every case-insensitive match of the search (odd parts are matches). */
function highlight(text: string | null | undefined): string[] {
	if (!text) return [];
	if (!search.value) return [text];
	const escaped = search.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return text.split(new RegExp(`(${escaped})`, 'gi'));
}

const MARK = 'bg-transparent font-semibold text-brand-500 dark:text-brand-400';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<PrivateView
		:title="$t('settings_permissions')"
		icon="admin_panel_settings"
		:breadcrumb="[{ name: $t('settings'), to: '/settings' }]"
	>
		<template #actions>
			<SearchInput
				v-if="!loading"
				v-model="search"
				:autofocus="policies.length > 25"
				:placeholder="$t('search_policy')"
				:show-filter="false"
			/>

			<BoButton icon="add" :to="addNewLink" :aria-label="$t('create_policy')" :title="$t('create_policy')" />
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div v-if="!search || filteredPolicies.length > 0" class="policies max-w-5xl">
			<BoTable
				v-model:columns="columns"
				show-resize
				:rows="filteredPolicies"
				row-key="id"
				:loading="loading"
				:append-width="48"
				@click:row="navigateToPolicy"
			>
				<template #[`item.icon`]="{ item }">
					<BoIcon class="icon text-gray-500 dark:text-gray-400" :name="item.icon" size="sm" />
				</template>

				<template #[`item.name`]="{ item }">
					<div v-if="item.name" class="name truncate text-gray-800 dark:text-white/90" :title="item.name">
						<template v-for="(part, index) in highlight(item.name)" :key="index">
							<mark v-if="index % 2" :class="MARK">{{ part }}</mark>
							<template v-else>{{ part }}</template>
						</template>
					</div>
				</template>

				<template #[`item.description`]="{ item }">
					<div v-if="item.description" class="description truncate" :title="item.description">
						<template v-for="(part, index) in highlight(item.description)" :key="index">
							<mark v-if="index % 2" :class="MARK">{{ part }}</mark>
							<template v-else>{{ part }}</template>
						</template>
					</div>
				</template>

				<template #item-append="{ item }">
					<BoMenu
						:items="[
							{
								text: $t('duplicate_policy'),
								icon: 'content_copy',
								onSelect: () => openDuplicateDialog(item as PolicyItem),
							},
						]"
						side="left"
						align="start"
					>
						<template #trigger>
							<button
								type="button"
								class="ctx-toggle inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
								:class="FOCUS"
								:aria-label="$t('item_options', { item: item.name })"
							>
								<BoIcon name="more_vert" size="sm" />
							</button>
						</template>
					</BoMenu>
				</template>
			</BoTable>
		</div>

		<BoInfo v-else icon="search" :title="$t('no_results')">
			{{ $t('no_results_copy') }}

			<template #append>
				<BoButton @click="search = null">{{ $t('clear_filters') }}</BoButton>
			</template>
		</BoInfo>

		<BoDialog v-model:open="duplicateDialogActive" :title="$t('duplicate_policy')">
			<form id="duplicate-policy-form" @submit.prevent="duplicate">
				<BoInput v-model="duplicateName" autofocus :aria-label="$t('policy_name')" />
			</form>

			<template #actions>
				<BoButton variant="secondary" @click="duplicateDialogActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="duplicate-policy-form" :disabled="!duplicateName" :loading="duplicating">
					{{ $t('duplicate') }}
				</BoButton>
			</template>
		</BoDialog>

		<RouterView name="add" />
	</PrivateView>
</template>
