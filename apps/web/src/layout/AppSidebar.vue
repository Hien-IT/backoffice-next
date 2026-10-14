<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice: registeredModules from modules/index.ts (no extensions store); the Documentation link of the Directus
// default is dropped even from a saved module_bar (FR-081, D-49); the active module gets aria-current and a bar
// marker (FR-021); links open in a new tab with rel="noopener noreferrer".
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import BoButton from '../components/BoButton.vue';
import BoTooltip from '../components/BoTooltip.vue';
import { DIRECTUS_DOCS_URL, MODULE_BAR_DEFAULT } from '../constants.ts';
import { registeredModules } from '../modules/index.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { translate } from '../utils/translate-object-values.ts';
import ModuleBarAvatar from './ModuleBarAvatar.vue';
import ModuleBarLogo from './ModuleBarLogo.vue';

type ModuleBarItem = { id: string; name: string; icon: string; to?: string; href?: string };

const settingsStore = useSettingsStore();
const route = useRoute();

const registeredModuleIDs = computed(() => registeredModules.value.map((module) => module.id));

const modules = computed<ModuleBarItem[]>(() => {
	if (!settingsStore.settings) return [];

	return (settingsStore.settings.module_bar ?? MODULE_BAR_DEFAULT)
		.filter((modulePart) => {
			if (modulePart.type === 'link') return !(modulePart.id === 'docs' && modulePart.url === DIRECTUS_DOCS_URL);
			return modulePart.enabled && registeredModuleIDs.value.includes(modulePart.id);
		})
		.map((modulePart) => {
			if (modulePart.type === 'link') {
				const { id, name, icon, url } = modulePart;
				const link: ModuleBarItem = url.startsWith('/') ? { id, name, icon, to: url } : { id, name, icon, href: url };

				return translate(link);
			}

			const module = registeredModules.value.find((module) => module.id === modulePart.id)!;

			return translate({ id: module.id, name: module.name, icon: module.icon, to: `/${module.id}` });
		});
});

function isActive(item: ModuleBarItem) {
	return item.to !== undefined && (route.path === item.to || route.path.startsWith(`${item.to}/`));
}
</script>

<template>
	<div class="flex h-full w-eh-12 shrink-0 flex-col border-e border-eh-border bg-eh-surface-default">
		<ModuleBarLogo />

		<nav :aria-label="$t('modules')" data-testid="module-bar" class="grow overflow-y-auto overflow-x-hidden">
			<ul class="m-0 flex list-none flex-col items-center gap-eh-1 p-0 py-eh-2">
				<li v-for="modulePart in modules" :key="modulePart.id">
					<BoTooltip :text="modulePart.name" side="right">
						<BoButton
							variant="ghost"
							:icon="modulePart.icon"
							:aria-label="modulePart.name"
							v-bind="modulePart.to !== undefined ? { to: modulePart.to } : { href: modulePart.href! }"
							:target="modulePart.href ? '_blank' : undefined"
							:rel="modulePart.href ? 'noopener noreferrer' : undefined"
							:aria-current="isActive(modulePart) ? 'page' : undefined"
							class="relative aria-[current=page]:bg-eh-surface-subtle aria-[current=page]:text-eh-action-primary aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-eh-2 aria-[current=page]:before:-start-eh-1 aria-[current=page]:before:w-eh-1 aria-[current=page]:before:rounded-eh-full aria-[current=page]:before:bg-eh-action-primary"
						/>
					</BoTooltip>
				</li>
			</ul>
		</nav>

		<ModuleBarAvatar />
	</div>
</template>
