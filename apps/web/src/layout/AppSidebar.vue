<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice: the module bar becomes the TailAdmin sidebar (design-system layout-patterns §2, D-52): logo area, one
// "Menu" group of modules with icon and label (L-2), the navigation slot of the current module as its sub-menu
// (one level, L-3). From `xl` the sidebar is fixed inline, 290 px or a 90 px rail that expands while hovered or
// holding keyboard focus; below `xl` it is a drawer (Reka Dialog: backdrop, focus trap, Esc, focus back to the
// opener). Module list as Directus: registeredModules from modules/index.ts (no extensions store); the Documentation
// link of the Directus default is dropped even from a saved module_bar (FR-081, D-49); the active module gets
// aria-current and a bar marker (FR-021); links open in a new tab with rel="noopener noreferrer". The avatar menu
// moved to the header (UserMenu.vue).
import { createReusableTemplate } from '@vueuse/core';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed, ref, useId } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import { DIRECTUS_DOCS_URL, MODULE_BAR_DEFAULT } from '../constants.ts';
import { registeredModules } from '../modules/index.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { translate } from '../utils/translate-object-values.ts';
import SidebarLogo from './SidebarLogo.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

type ModuleBarItem = { id: string; name: string; icon: string; to?: string; href?: string };

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const settingsStore = useSettingsStore();
const navBarStore = useNavBarStore();
const route = useRoute();
const groupId = useId();

const [DefineSidebar, ReuseSidebar] = createReusableTemplate();

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

// TailAdmin isHovered; keyboard focus expands the rail too (layout-patterns, accessibility). A mouse click also
// focuses the link, so only :focus-visible counts.
const hovered = ref(false);
const focused = ref(false);
const expanded = computed(() => drawer || !navBarStore.collapsed || hovered.value || focused.value);

function onFocusin(event: FocusEvent) {
	try {
		focused.value = (event.target as HTMLElement).matches(':focus-visible');
	} catch {
		focused.value = true;
	}
}

function onFocusout(event: FocusEvent) {
	if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) focused.value = false;
}
</script>

<template>
	<DefineSidebar>
		<aside
			id="navigation"
			tabindex="-1"
			:aria-label="$t('navigation')"
			class="flex h-full flex-col border-e border-gray-200 bg-white px-5 text-gray-900 dark:border-gray-800 dark:bg-gray-900"
			:class="
				drawer
					? 'w-full'
					: [
							'fixed start-0 top-0 z-99999 h-screen transition-all duration-300 ease-in-out motion-reduce:transition-none',
							expanded ? 'w-[290px]' : 'w-[90px]',
						]
			"
			@mouseenter="hovered = true"
			@mouseleave="hovered = false"
			@focusin="onFocusin"
			@focusout="onFocusout"
		>
			<SidebarLogo :collapsed="!expanded" />

			<div class="no-scrollbar flex min-h-0 flex-col overflow-y-auto">
				<nav :aria-labelledby="groupId" data-testid="module-bar" class="mb-6">
					<h2
						:id="groupId"
						class="mb-4 flex text-xs leading-5 text-gray-500 uppercase dark:text-gray-400"
						:class="expanded ? 'justify-start' : 'justify-center'"
					>
						<span :class="{ 'sr-only': !expanded }">{{ $t('modules') }}</span>
						<BoIcon v-if="!expanded" name="more_horiz" size="sm" />
					</h2>

					<ul class="m-0 flex list-none flex-col gap-1 p-0">
						<li v-for="modulePart in modules" :key="modulePart.id">
							<component
								:is="modulePart.to !== undefined ? RouterLink : 'a'"
								v-bind="
									modulePart.to !== undefined
										? { to: modulePart.to }
										: { href: modulePart.href, target: '_blank', rel: 'noopener noreferrer' }
								"
								:aria-current="isActive(modulePart) ? 'page' : undefined"
								class="menu-item group no-underline before:absolute before:inset-y-2 before:-start-2 before:w-1 before:rounded-full aria-[current=page]:before:bg-brand-500 dark:aria-[current=page]:before:bg-brand-400"
								:class="[
									isActive(modulePart) ? 'menu-item-active' : 'menu-item-inactive',
									{ 'justify-center': !expanded },
								]"
							>
								<span class="flex" :class="isActive(modulePart) ? 'menu-item-icon-active' : 'menu-item-icon-inactive'">
									<BoIcon :name="modulePart.icon" />
								</span>
								<span class="truncate" :class="{ 'sr-only': !expanded }">{{ modulePart.name }}</span>
								<template v-if="modulePart.href">
									<BoIcon
										v-if="expanded"
										name="open_in_new"
										size="sm"
										class="ms-auto text-gray-500 dark:text-gray-400"
									/>
									<span class="sr-only">&#32;({{ $t('open_in_new_window') }})</span>
								</template>
							</component>

							<div v-if="expanded && isActive(modulePart) && $slots['navigation']" class="ms-9 mt-2">
								<slot name="navigation" />
							</div>
						</li>
					</ul>
				</nav>
			</div>
		</aside>
	</DefineSidebar>

	<DialogRoot v-if="drawer" v-model:open="navBarStore.drawerOpen">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-9999 bg-gray-900/50" />
			<DialogContent :aria-describedby="undefined" class="fixed inset-y-0 start-0 z-99999 w-[290px] max-w-full">
				<DialogTitle class="sr-only">{{ $t('navigation') }}</DialogTitle>
				<ReuseSidebar />
			</DialogContent>
		</DialogPortal>
	</DialogRoot>

	<ReuseSidebar v-else />
</template>
