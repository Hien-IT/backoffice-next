<!-- Ported from directus/app/src/modules/insights/components/navigation.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-004, layout-patterns §7): flat sub-menu rows like SettingsNavigation (016 Q-24), the dashboard
// color is user data (inline style); the create button when there is no dashboard, as DR.
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import { useCollectionPermissions } from '../../../composables/use-permissions/index.ts';
import { type Dashboard, useInsightsStore } from '../../../stores/insights.ts';

defineEmits(['create']);

const route = useRoute();
const insightsStore = useInsightsStore();
const { createAllowed } = useCollectionPermissions('directus_dashboards');

const navItems = computed(() =>
	insightsStore.dashboards.map((dashboard: Dashboard) => ({
		icon: dashboard.icon,
		color: dashboard.color,
		name: dashboard.name,
		to: `/insights/${dashboard.id}`,
	})),
);

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = 'menu-dropdown-item min-h-9 gap-2 py-1 text-sm no-underline';
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('insights')">
		<BoButton v-if="navItems.length === 0 && createAllowed" variant="secondary" full-width @click="$emit('create')">
			{{ $t('create_dashboard') }}
		</BoButton>

		<ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
			<li v-for="navItem in navItems" :key="navItem.to">
				<RouterLink
					:to="navItem.to"
					:class="[ROW, FOCUS, isActive(navItem.to) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
					:aria-current="isActive(navItem.to) ? 'page' : undefined"
				>
					<BoIcon
						:name="navItem.icon"
						size="sm"
						class="shrink-0"
						:style="navItem.color ? { color: navItem.color } : undefined"
					/>
					<BoTextOverflow :text="navItem.name" />
				</RouterLink>
			</li>
		</ul>
	</nav>
</template>
