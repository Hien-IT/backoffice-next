<!-- Ported from directus/app/src/views/private/components/module-bar-logo.vue -->
<script setup lang="ts">
// Backoffice: the logo at the top of the sidebar (layout-patterns §2, D-157; Directus module-bar-logo.vue and
// private-view-nav-project-name.vue): the logo, the project name and the descriptor in white on the project color block
// of the sidebar (owner's mock-up 2026-10-22; `Backoffice` when project_name is empty, FR-026). An uploaded
// project_logo sits on a white tile (owner 2026-10-22), the default app icon on none. The default app icon (owner 2026-10-22, D-159) shows as is, without a tile; an
// uploaded project_logo keeps the project color tile. The Backoffice logo (light/dark SVG) replaces the animated
// Directus sprite, so the loader is the progress bar for both logos; project_url is a link only with an http(s)
// scheme (FR-026).
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import logo from '../assets/logo.png';
import BoProgressLinear from '../components/BoProgressLinear.vue';
import BoTooltip from '../components/BoTooltip.vue';
import { useRequestsStore } from '../stores/requests.ts';
import { useServerStore } from '../stores/server.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { getAssetUrl } from '../utils/get-asset-url.ts';

const { t } = useI18n();

const requestsStore = useRequestsStore();
const settingsStore = useSettingsStore();
const serverStore = useServerStore();

const customLogoPath = computed<string | null>(() => {
	if (settingsStore.settings === null) return null;
	if (!settingsStore.settings?.project_logo) return null;
	return getAssetUrl(settingsStore.settings.project_logo);
});

const showLoader = ref(false);

const { queueHasItems } = toRefs(requestsStore);

watch(
	() => queueHasItems.value,
	(hasItems) => {
		// Backoffice: no sprite animation to wait for, the bar stops when the queue is empty.
		showLoader.value = hasItems;
	},
);

const url = computed(() => {
	const projectUrl = settingsStore.settings?.project_url;
	if (!projectUrl) return null;

	try {
		return ['http:', 'https:'].includes(new URL(projectUrl).protocol) ? projectUrl : null;
	} catch {
		return null;
	}
});

// Backoffice: the name of the server info only, where the Directus default name is already dropped (D-51).
const name = computed(() => serverStore.info.project?.project_name || 'Backoffice');
const descriptor = computed(() => serverStore.info.project?.project_descriptor);
</script>

<template>
	<div class="flex min-w-0 shrink-0">
		<component
			:is="url ? BoTooltip : 'div'"
			v-bind="url ? { text: t('view_project'), side: 'bottom' } : { class: 'contents' }"
		>
			<component
				:is="url ? 'a' : 'div'"
				v-bind="url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {}"
				class="flex min-w-0 items-center gap-3 rounded-lg text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<span
					class="relative flex size-12 shrink-0 items-center justify-center rounded-lg"
					:class="{ 'bg-white p-1.5': customLogoPath }"
				>
					<img v-if="customLogoPath" :src="customLogoPath" :alt="name" class="size-full object-contain" />
					<img v-else :src="logo" :alt="name" class="size-full object-contain" />
					<BoProgressLinear
						v-if="showLoader"
						indeterminate
						:aria-label="$t('loading')"
						class="absolute! inset-x-1 bottom-0.5 w-auto!"
					/>
				</span>
				<!-- The logo alt already names the project: the visible name is not read twice. -->
				<span class="min-w-0 leading-tight">
					<span class="block truncate text-lg font-semibold" aria-hidden="true" :title="name">{{ name }}</span>
					<span v-if="descriptor" class="mt-0.5 block truncate text-theme-xs text-white/80" :title="descriptor">
						{{ descriptor }}
					</span>
				</span>
			</component>
		</component>
	</div>
</template>
