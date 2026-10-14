<!-- Ported from directus/app/src/views/private/components/module-bar-logo.vue -->
<script setup lang="ts">
// Backoffice: the Backoffice logo (light/dark SVG) replaces the animated Directus sprite, so the loader is the
// progress bar for both logos; project_url is a link only with an http(s) scheme (FR-026).
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

const logoAlt = computed(
	// Backoffice: the name of the server info only, where the Directus default name is already dropped (D-51).
	() => serverStore.info.project?.project_name || 'Backoffice',
);
</script>

<template>
	<component
		:is="url ? BoTooltip : 'div'"
		v-bind="url ? { text: t('view_project'), side: 'right' } : { class: 'contents' }"
	>
		<component
			:is="url ? 'a' : 'div'"
			v-bind="url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {}"
			class="relative flex size-eh-12 shrink-0 items-center justify-center bg-project p-eh-2"
		>
			<img v-if="customLogoPath" :src="customLogoPath" :alt="logoAlt" class="size-full object-contain" />
			<template v-else>
				<img :src="logoLight" :alt="logoAlt" class="size-full object-contain dark:hidden" />
				<img :src="logoDark" :alt="logoAlt" class="hidden size-full object-contain dark:block" />
			</template>
			<BoProgressLinear v-if="showLoader" indeterminate class="absolute! inset-x-eh-2 bottom-eh-1 w-auto!" />
		</component>
	</component>
</template>
