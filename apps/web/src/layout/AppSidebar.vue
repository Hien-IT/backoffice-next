<!-- Ported from directus/app/src/views/private/components/module-bar.vue -->
<script setup lang="ts">
// Backoffice: the module bar becomes the TailAdmin sidebar (design-system layout-patterns §2, D-52): logo area, one
// "Menu" group of modules with icon and label (L-2), the navigation slot of the current module as its sub-menu
// (one level, L-3). From `xl` the sidebar is fixed inline, 290 px or a 90 px rail that expands while hovered or
// holding keyboard focus; below `xl` it is a drawer (Reka Dialog: backdrop, focus trap, Esc, focus back to the
// opener). Module list as Directus: registeredModules from modules/index.ts (no extensions store); the Documentation
// link of the Directus default is dropped even from a saved module_bar (FR-081, D-49); the active module gets
// aria-current and a bar marker (FR-021); links open in a new tab with rel="noopener noreferrer". The user menu and the
// notifications bell sit under the logo (owner 2026-10-20), stacked on the rail. Modules of app extensions are grouped
// under one "Extensions" row like the Settings sub-menu (owner 2026-10-22, D-144): in module_bar order and enabled
// state, the open one shows its own navigation one level below.
import { createReusableTemplate } from '@vueuse/core';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed, ref, useId, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import NotificationsBell from './NotificationsBell.vue';
import UserMenu from './UserMenu.vue';
import { DIRECTUS_DOCS_URL, MODULE_BAR_DEFAULT } from '../constants.ts';
import { getInternalModules, registeredModules } from '../modules/index.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useUserStore } from '../stores/user.ts';
import { translate } from '../utils/translate-object-values.ts';
import SidebarLogo from './SidebarLogo.vue';
import { useNavBarStore } from './stores/nav-bar.ts';

type ModuleBarItem = { id: string; name: string; icon: string; to?: string; href?: string; extension?: boolean };

const INTERNAL_MODULE_IDS = new Set(getInternalModules().map(({ id }) => id));

const { drawer = false } = defineProps<{ drawer?: boolean }>();

const settingsStore = useSettingsStore();
const userStore = useUserStore();
const navBarStore = useNavBarStore();
const route = useRoute();
const groupId = useId();

const [DefineSidebar, ReuseSidebar] = createReusableTemplate();

const registeredModuleIDs = computed(() => registeredModules.value.map((module) => module.id));

const modules = computed<ModuleBarItem[]>(() => {
	// Backoffice: a share session cannot read /settings; it gets the default bar of its registered modules (FR-084).
	const share = !!userStore.currentUser && 'share' in userStore.currentUser;
	if (!settingsStore.settings && !share) return [];

	return (settingsStore.settings?.module_bar ?? MODULE_BAR_DEFAULT)
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

			return translate({
				id: module.id,
				name: module.name,
				icon: module.icon,
				to: `/${module.id}`,
				extension: !INTERNAL_MODULE_IDS.has(module.id),
			});
		});
});

const mainModules = computed(() => modules.value.filter((modulePart) => !modulePart.extension));
const extensionModules = computed(() => modules.value.filter((modulePart) => modulePart.extension));
const extensionsActive = computed(() => extensionModules.value.some(isActive));
const extensionsOpen = ref(false);
const extensionsListId = useId();

// The group opens on the page of an extension module; the user closes or opens it with its row.
watch(extensionsActive, (active) => active && (extensionsOpen.value = true), { immediate: true });

function isActive(item: ModuleBarItem) {
	return item.to !== undefined && (route.path === item.to || route.path.startsWith(`${item.to}/`));
}

// Backoffice (spec 018 FR-061, owner 2026-10-18): a module without a row in the bar (Activity is `hidden`, as in
// Directus, where its navigation still shows in the module's own column) shows only its sub-menu under the list, no
// title row; it is reached from the notifications drawer, as in Directus.
const openUnlisted = computed<ModuleBarItem | null>(() => {
	if (modules.value.some(isActive)) return null;
	const module = registeredModules.value.find(({ id }) => route.path === `/${id}` || route.path.startsWith(`/${id}/`));
	return module ? translate({ id: module.id, name: module.name, icon: module.icon }) : null;
});

// TailAdmin isHovered; keyboard focus expands the rail too (layout-patterns, accessibility). A mouse click also
// focuses the link, so only :focus-visible counts.
const hovered = ref(false);
const focused = ref(false);
// The user menu and the bell panel are portaled out of the sidebar: moving into them is a mouseleave, so the rail
// stays expanded while one is open.
const userMenuOpen = ref(false);
const bellOpen = ref(false);
const expanded = computed(
	() => drawer || !navBarStore.collapsed || hovered.value || focused.value || userMenuOpen.value || bellOpen.value,
);

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

			<div class="mb-6 flex items-center gap-3" :class="expanded ? 'justify-between' : 'flex-col'">
				<UserMenu v-model:open="userMenuOpen" :collapsed="!expanded" />
				<!-- Below `xl` (drawer) the bell is in the header (AppHeader.vue). -->
				<NotificationsBell v-if="!drawer" v-model:open="bellOpen" :compact="!expanded" />
			</div>

			<div class="no-scrollbar flex min-h-0 flex-col overflow-y-auto">
				<nav :aria-labelledby="groupId" data-testid="module-bar" class="mb-6">
					<!-- Backoffice (016, user request): no visible "Modules" title; it stays the name of the nav. -->
					<h2 :id="groupId" class="sr-only">{{ $t('modules') }}</h2>

					<ul class="m-0 flex list-none flex-col gap-1 p-0">
						<li v-for="modulePart in mainModules" :key="modulePart.id" class="relative">
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

							<!-- Actions of the open module on its row (the Content hidden-collections toggle), teleported by the
								module navigation; outside the link, since a button cannot sit in a link. -->
							<div
								v-if="expanded && isActive(modulePart) && $slots['navigation']"
								:id="`module-actions-${modulePart.id}`"
								class="absolute end-1 top-1 flex items-center empty:hidden"
							/>

							<div v-if="expanded && isActive(modulePart) && $slots['navigation']" class="ms-9 mt-2">
								<slot name="navigation" />
							</div>
						</li>

						<li v-if="extensionModules.length > 0" class="relative" data-module-group="extensions">
							<button
								type="button"
								class="menu-item group w-full before:absolute before:inset-y-2 before:-start-2 before:w-1 before:rounded-full"
								:class="[
									extensionsActive
										? 'menu-item-active before:bg-brand-500 dark:before:bg-brand-400'
										: 'menu-item-inactive',
									{ 'justify-center': !expanded },
								]"
								:aria-expanded="extensionsOpen"
								:aria-controls="extensionsListId"
								@click="extensionsOpen = !extensionsOpen"
							>
								<span class="flex" :class="extensionsActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'">
									<BoIcon name="extension" />
								</span>
								<!-- No chevron, like the Content and Settings rows (owner 2026-10-22); aria-expanded tells the state. -->
								<span class="truncate" :class="{ 'sr-only': !expanded }">{{ $t('extensions') }}</span>
							</button>

							<ul
								v-if="expanded && extensionsOpen"
								:id="extensionsListId"
								class="m-0 ms-9 mt-2 flex list-none flex-col gap-1 p-0"
							>
								<li v-for="modulePart in extensionModules" :key="modulePart.id" class="relative">
									<RouterLink
										:to="modulePart.to!"
										:aria-current="isActive(modulePart) ? 'page' : undefined"
										class="menu-dropdown-item min-h-9 gap-2 py-1 text-sm no-underline"
										:class="isActive(modulePart) ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'"
									>
										<BoIcon :name="modulePart.icon" size="sm" class="shrink-0" />
										<span class="truncate">{{ modulePart.name }}</span>
									</RouterLink>

									<div
										v-if="isActive(modulePart) && $slots['navigation']"
										:id="`module-actions-${modulePart.id}`"
										class="absolute end-1 top-0.5 flex items-center empty:hidden"
									/>

									<div v-if="isActive(modulePart) && $slots['navigation']" class="ms-6 mt-2">
										<slot name="navigation" />
									</div>
								</li>
							</ul>
						</li>

						<!-- The sub-menu of an open module without a row (Activity), under the list, without a title row. -->
						<li v-if="openUnlisted && expanded && $slots['navigation']" class="mt-3" data-module-unlisted>
							<slot name="navigation" />
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
