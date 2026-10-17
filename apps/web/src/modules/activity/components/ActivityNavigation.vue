<!-- Ported from directus/app/src/modules/activity/components/navigation.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-004, FR-061, layout-patterns §7): flat sub-menu rows like SettingsNavigation (016 Q-24), as
// buttons since the filter is the page's `v-model:filter` (a local ref, not the URL, research T001 (e)); the active row
// has `aria-current`. Same rows, icons and filters as Directus.
import type { Filter } from '@directus/types';
import { computed } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import { useUserStore } from '../../../stores/user.ts';

const props = defineProps<{
	filter?: Filter | null | undefined;
}>();

const emit = defineEmits(['update:filter']);

const userStore = useUserStore();
// Backoffice: a share session has no user id.
const currentUserID = computed(() =>
	userStore.currentUser && 'id' in userStore.currentUser ? userStore.currentUser.id : undefined,
);

const filterField = computed(() => Object.keys(props.filter ?? {})[0] ?? null);
const filterValue = computed(
	() => (Object.values(props.filter ?? {})[0] as { _eq?: unknown } | undefined)?._eq ?? null,
);

function setNavFilter(key: string, value: any) {
	emit('update:filter', {
		[key]: {
			_eq: value,
		},
	});
}

function clearNavFilter() {
	emit('update:filter', null);
}

const actions = [
	{ value: 'create', icon: 'add', text: 'create' },
	{ value: 'update', icon: 'check', text: 'update' },
	{ value: 'delete', icon: 'clear', text: 'delete_label' },
	{ value: 'login', icon: 'login', text: 'login' },
	{ value: 'logout', icon: 'logout', text: 'logout' },
];

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = 'menu-dropdown-item min-h-9 w-full cursor-pointer gap-2 py-1 text-start text-sm';
const rowClass = (active: boolean) => [
	ROW,
	FOCUS,
	active ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive',
];
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('activity')">
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			<li>
				<button
					type="button"
					:class="rowClass(!filterField)"
					:aria-current="!filterField ? 'true' : undefined"
					@click="clearNavFilter"
				>
					<BoIcon name="access_time" size="sm" class="shrink-0" />
					<BoTextOverflow :text="$t('all_activity')" />
				</button>
			</li>
			<li>
				<button
					type="button"
					:class="rowClass(filterField === 'user' && filterValue === currentUserID)"
					:aria-current="filterField === 'user' && filterValue === currentUserID ? 'true' : undefined"
					@click="setNavFilter('user', currentUserID)"
				>
					<BoIcon name="face" size="sm" class="shrink-0" />
					<BoTextOverflow :text="$t('my_activity')" />
				</button>
			</li>
		</ul>

		<div class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />

		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			<li v-for="action in actions" :key="action.value">
				<button
					type="button"
					:class="rowClass(filterField === 'action' && filterValue === action.value)"
					:aria-current="filterField === 'action' && filterValue === action.value ? 'true' : undefined"
					@click="setNavFilter('action', action.value)"
				>
					<BoIcon :name="action.icon" size="sm" class="shrink-0" />
					<BoTextOverflow :text="$t(action.text)" />
				</button>
			</li>
		</ul>
	</nav>
</template>
