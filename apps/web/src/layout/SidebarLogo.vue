<!-- Ported from directus/app/src/views/private/components/module-bar-logo.vue -->
<script setup lang="ts">
// Backoffice: logo area of the TailAdmin sidebar (layout-patterns §2): the logo on the --project-color background
// plus the project name and descriptor of private-view-nav-project-name.vue (`Backoffice` when project_name is
// empty, FR-026), name hidden on the collapsed rail. The Backoffice logo (light/dark SVG) replaces the animated
// Directus sprite, so the loader is the progress bar for both logos; project_url is a link only with an http(s)
// scheme (FR-026).
import { computed, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import BoProgressLinear from '../components/BoProgressLinear.vue';
import BoTooltip from '../components/BoTooltip.vue';
import { useRequestsStore } from '../stores/requests.ts';
import { useServerStore } from '../stores/server.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { getAssetUrl } from '../utils/get-asset-url.ts';

const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

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
	<div class="flex pt-8 pb-7" :class="{ 'justify-center': collapsed }">
		<component
			:is="url ? BoTooltip : 'div'"
			v-bind="url ? { text: t('view_project'), side: 'right' } : { class: 'contents' }"
		>
			<component
				:is="url ? 'a' : 'div'"
				v-bind="url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {}"
				class="flex min-w-0 items-center gap-3 rounded-lg text-gray-800 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90 dark:focus-visible:outline-brand-400"
			>
				<span class="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--project-color) p-1.5">
					<img v-if="customLogoPath" :src="customLogoPath" :alt="name" class="size-full object-contain" />
					<template v-else>
						<img :src="logoLight" :alt="name" class="size-full object-contain dark:hidden" />
						<img :src="logoDark" :alt="name" class="hidden size-full object-contain dark:block" />
					</template>
					<BoProgressLinear
						v-if="showLoader"
						indeterminate
						:aria-label="$t('loading')"
						class="absolute! inset-x-1 bottom-0.5 w-auto!"
					/>
				</span>
				<!-- The logo alt already names the project: the visible name is not read twice. -->
				<span v-if="!collapsed" class="min-w-0 leading-tight">
					<span class="block truncate text-base font-semibold" aria-hidden="true" :title="name">{{ name }}</span>
					<span
						v-if="descriptor"
						class="block truncate text-theme-xs text-gray-500 dark:text-gray-400"
						:title="descriptor"
					>
						{{ descriptor }}
					</span>
				</span>
			</component>
		</component>
	</div>
</template>
