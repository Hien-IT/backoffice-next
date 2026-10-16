<!-- Ported from directus/app/src/modules/settings/routes/roles/collection.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US4-1, recipe Q-2): BoTable with the Directus headers and requests; the create button is a
// BoButton link. BoTextOverflow has no `highlight` yet, so the search match is marked here (v-highlight: every match,
// any case). The table is not `fixed-header` (it needs a bounded parent; the page scrolls). Errors open the error
// dialog (D-66).
import type { Role } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRouter } from 'vue-router';
import BoButton from '../../../../components/BoButton.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoInfo from '../../../../components/BoInfo.vue';
import BoTable, { type BoTableColumn } from '../../../../components/BoTable.vue';
import RenderDisplay from '../../../../components/render/RenderDisplay.vue';
import ValueNull from '../../../../components/render/ValueNull.vue';
import SearchInput from '../../../../components/SearchInput.vue';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import PrivateView from '../../../../layout/PrivateView.vue';
import { fetchAll } from '../../../../utils/fetch-all.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import SettingsNavigation from '../../components/SettingsNavigation.vue';

const { t } = useI18n();

type RoleBaseFields = 'id' | 'name' | 'description' | 'icon';

type RoleResponse = Pick<Role, RoleBaseFields> & {
	users: [{ count: { id: number } }];
	children: { id: string; name: string }[];
};

type RoleItem = Pick<Role, RoleBaseFields> & {
	public?: boolean;
	count?: number;
	children?: { id: string; name: string }[];
};

const router = useRouter();

const roles = ref<RoleItem[]>([]);
const loading = ref(false);

const search = ref<string | null>(null);

const filteredRoles = computed(() => {
	const normalizedSearch = search.value?.toLowerCase();
	if (!normalizedSearch) return roles.value;
	return roles.value.filter(
		(role) =>
			role.name?.toLowerCase().includes(normalizedSearch) || role.description?.toLowerCase().includes(normalizedSearch),
	);
});

const childrenDisplay = {
	display: 'related-values',
	options: { template: '{{ name }}' },
	field: 'children',
	collection: 'directus_roles',
};

const columns = ref<BoTableColumn[]>([
	{ label: '', key: 'icon', sortable: false, width: 42, align: 'left' },
	{ label: t('name'), key: 'name', sortable: false, width: 200, align: 'left' },
	{ label: t('users'), key: 'count', sortable: false, width: 140, align: 'left' },
	{ label: t('fields.directus_roles.children'), key: 'children', sortable: false, width: 140, align: 'left' },
	{ label: t('description'), key: 'description', sortable: false, width: 470, align: 'left' },
]);

fetchRoles();

const addNewLink = computed(() => {
	return `/settings/roles/+`;
});

async function fetchRoles() {
	loading.value = true;

	try {
		const response = await fetchAll<RoleResponse>(`/roles`, {
			params: {
				limit: -1,
				fields: ['id', 'name', 'description', 'icon', 'users', 'children.name', 'children.id'],
				deep: {
					users: {
						_aggregate: { count: 'id' },
						_groupBy: ['role'],
						_sort: 'role',
						_limit: -1,
					},
				},
				sort: 'name',
			},
		});

		roles.value = [
			{
				id: 'public',
				name: t('public_label'),
				description: t('public_description'),
				icon: 'public',
				public: true,
			},
			...response.map((role) => {
				return {
					...translate(role),
					count: role.users[0]?.count.id || 0,
				};
			}),
		];
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		loading.value = false;
	}
}

function navigateToRole({ item }: { item: Record<string, any> }) {
	if (item['id'] === 'public') {
		router.push({ name: 'settings-roles-public-item' });
		return;
	} else {
		router.push({
			name: 'settings-roles-item',
			params: { primaryKey: item['id'] },
		});
	}
}

/** v-highlight: the text split around every case-insensitive match of the search (odd parts are matches). */
function highlight(text: string | null | undefined): string[] {
	if (!text) return [];
	if (!search.value) return [text];
	const escaped = search.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return text.split(new RegExp(`(${escaped})`, 'gi'));
}

const MARK = 'bg-transparent font-semibold text-brand-500 dark:text-brand-400';
</script>

<template>
	<PrivateView :title="$t('settings_roles')" icon="group" :breadcrumb="[{ name: $t('settings'), to: '/settings' }]">
		<template #actions>
			<SearchInput
				v-if="!loading"
				v-model="search"
				:autofocus="roles.length > 25"
				:placeholder="$t('search_role')"
				:show-filter="false"
			/>

			<BoButton icon="add" :to="addNewLink" :aria-label="$t('create_role')" :title="$t('create_role')" />
		</template>

		<template #navigation>
			<SettingsNavigation />
		</template>

		<div v-if="!search || filteredRoles.length > 0" class="roles max-w-5xl">
			<BoTable
				v-model:columns="columns"
				show-resize
				:rows="filteredRoles"
				row-key="id"
				:loading="loading"
				@click:row="navigateToRole"
			>
				<template #[`item.icon`]="{ item }">
					<BoIcon
						class="icon"
						:name="item.icon"
						size="sm"
						:class="item.public ? 'public text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'"
					/>
				</template>

				<template #[`item.name`]="{ item }">
					<div
						class="name truncate"
						:class="item.public ? 'public text-brand-500 dark:text-brand-400' : 'text-gray-800 dark:text-white/90'"
						:title="item.name"
					>
						<template v-for="(part, index) in highlight(item.name)" :key="index">
							<mark v-if="index % 2" :class="MARK">{{ part }}</mark>
							<template v-else>{{ part }}</template>
						</template>
					</div>
				</template>

				<template #[`item.count`]="{ item }">
					<ValueNull v-if="item.public" />
				</template>

				<template #[`item.description`]="{ item }">
					<div class="description truncate" :title="item.description">
						<template v-for="(part, index) in highlight(item.description)" :key="index">
							<mark v-if="index % 2" :class="MARK">{{ part }}</mark>
							<template v-else>{{ part }}</template>
						</template>
					</div>
				</template>

				<template #[`item.children`]="{ item }">
					<ValueNull v-if="item.public || item.children.length === 0" />
					<RenderDisplay
						v-else
						:value="item.children"
						:display="childrenDisplay.display"
						:options="childrenDisplay.options"
						:field="childrenDisplay.field"
						:collection="childrenDisplay.collection"
						type="alias"
					/>
				</template>
			</BoTable>
		</div>

		<BoInfo v-else icon="search" :title="$t('no_results')">
			{{ $t('no_results_copy') }}

			<template #append>
				<BoButton @click="search = null">{{ $t('clear_filters') }}</BoButton>
			</template>
		</BoInfo>

		<RouterView name="add" />
	</PrivateView>
</template>
