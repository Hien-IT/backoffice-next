<!-- Ported from directus/app/src/modules/settings/components/navigation.vue -->
<script setup lang="ts">
// Backoffice (spec 016 FR-003, layout-patterns §12, Q-24): a flat sub-menu of groups split by dividers. The AI and
// System Logs rows are out of scope (D-93); Extensions and Marketplace since spec 020 (Marketplace after Extensions, Q-42). No Report Bug / Request Feature group (D-94)
// and no version row at the end (D-95).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';

type Link = { icon: string; name: string; to: string };

const { t } = useI18n();
const route = useRoute();

const groups = computed<Link[][]>(() => [
	[
		{ icon: 'database', name: t('settings_data_model'), to: '/settings/data-model' },
		{ icon: 'bolt', name: t('settings_flows'), to: '/settings/flows' },
	],
	[
		{ icon: 'group', name: t('settings_roles'), to: '/settings/roles' },
		{ icon: 'admin_panel_settings', name: t('settings_permissions'), to: '/settings/policies' },
	],
	[
		{ icon: 'tune', name: t('settings_project'), to: '/settings/project' },
		{ icon: 'palette', name: t('settings_appearance'), to: '/settings/appearance' },
		{ icon: 'bookmark', name: t('settings_presets'), to: '/settings/presets' },
		{ icon: 'translate', name: t('settings_translations'), to: '/settings/translations' },
	],
	[
		{ icon: 'storefront', name: t('marketplace'), to: '/settings/marketplace' },
		{ icon: 'category', name: t('extensions'), to: '/settings/extensions' },
	],
]);

const isActive = (link: Link) => route.path === link.to || route.path.startsWith(`${link.to}/`);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = 'menu-dropdown-item min-h-9 gap-2 py-1 text-sm no-underline';
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('settings')">
		<template v-for="(group, index) in groups" :key="index">
			<div v-if="index > 0" class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />
			<ul class="m-0 flex list-none flex-col gap-1 p-0">
				<li v-for="link in group" :key="link.to">
					<RouterLink
						:to="link.to"
						:class="[ROW, FOCUS, isActive(link) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
						:aria-current="isActive(link) ? 'page' : undefined"
					>
						<BoIcon :name="link.icon" size="sm" class="shrink-0" />
						<BoTextOverflow :text="link.name" />
					</RouterLink>
				</li>
			</ul>
		</template>
	</nav>
</template>
