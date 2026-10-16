<!-- Ported from directus/app/src/modules/settings/components/navigation.vue -->
<script setup lang="ts">
// Backoffice (spec 016 FR-003, layout-patterns §12, Q-24): a flat sub-menu of five groups split by dividers. The AI,
// Marketplace, Extensions and System Logs rows are out of scope (D-93). Report Bug and Request Feature show only when
// settings has their URL, with no Directus default (D-94). The last row is the static word "Backoffice", not a link
// and without a version (D-95).
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import BoIcon from '../../../components/BoIcon.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import logo from '../../../assets/logo-light.svg';
import { useSettingsStore } from '../../../stores/settings.ts';

type Link = { icon: string; name: string; to?: string; href?: string };

const { t } = useI18n();
const route = useRoute();
const { settings } = storeToRefs(useSettingsStore());

const groups = computed<Link[][]>(() =>
	[
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
			{ icon: 'bug_report', name: t('report_bug'), href: urlOf(settings.value?.['report_bug_url']) },
			{ icon: 'new_releases', name: t('request_feature'), href: urlOf(settings.value?.['report_feature_url']) },
		].filter((link): link is Link & { href: string } => !!link.href),
	].filter((group) => group.length > 0),
);

function urlOf(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

const isActive = (link: Link) => !!link.to && (route.path === link.to || route.path.startsWith(`${link.to}/`));

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = 'menu-dropdown-item min-h-9 gap-2 py-1 text-sm no-underline';
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('settings')">
		<template v-for="(group, index) in groups" :key="index">
			<div v-if="index > 0" class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />
			<ul class="m-0 flex list-none flex-col gap-1 p-0">
				<li v-for="link in group" :key="link.to ?? link.href">
					<RouterLink
						v-if="link.to"
						:to="link.to"
						:class="[ROW, FOCUS, isActive(link) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
						:aria-current="isActive(link) ? 'page' : undefined"
					>
						<BoIcon :name="link.icon" size="sm" class="shrink-0" />
						<BoTextOverflow :text="link.name" />
					</RouterLink>
					<a
						v-else
						:href="link.href"
						target="_blank"
						rel="noopener noreferrer"
						:class="[ROW, FOCUS, 'menu-dropdown-item-inactive']"
					>
						<BoIcon :name="link.icon" size="sm" class="shrink-0" />
						<BoTextOverflow :text="link.name" />
						<BoIcon name="open_in_new" size="sm" class="ms-auto shrink-0 text-gray-500 dark:text-gray-400" />
						<span class="sr-only">&#32;({{ $t('open_in_new_window') }})</span>
					</a>
				</li>
			</ul>
		</template>

		<div class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />
		<p class="m-0 flex min-h-9 items-center gap-2 px-3 text-theme-xs text-gray-500 dark:text-gray-400">
			<img :src="logo" alt="" class="size-4 shrink-0 opacity-70" />
			Backoffice
		</p>
	</nav>
</template>
