<script setup lang="ts">
// Backoffice (owner 2026-10-22, D-157): the module bar as a grid of tiles in the project color block of the sidebar
// (AppSidebar, layout-patterns §2), like the pinned tiles of the Arc browser sidebar: an icon per module with its name in
// a tooltip and as the accessible name (sr-only). The active module has aria-current and the white tile; links to other
// sites open a new tab. The module_bar links (Add Link) and the app extension modules (D-144) share one tile with a menu
// (owner 2026-10-22, D-162), in module_bar order; links to other sites open a new tab from it.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
import BoTooltip from '../components/BoTooltip.vue';
import { type ModuleBarItem, useModuleBar } from './composables/use-module-bar.ts';

const { t } = useI18n();
const { mainModules, moreModules, isActive } = useModuleBar();

const moreActive = computed(() => moreModules.value.some(isActive));
const moreItems = computed<BoMenuItem[]>(() =>
	moreModules.value.map((modulePart) => ({
		text: modulePart.name,
		icon: modulePart.icon,
		to: modulePart.to,
		href: modulePart.href,
		active: isActive(modulePart),
	})),
);

const ITEM =
	'flex h-12 w-full items-center justify-center rounded-xl no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

function itemClass(active: boolean) {
	return [
		ITEM,
		active ? 'bg-white text-(--project-color) shadow-theme-xs' : 'bg-white/15 text-white hover:bg-white/25',
	];
}

function linkProps(modulePart: ModuleBarItem) {
	return modulePart.to !== undefined
		? { to: modulePart.to }
		: { href: modulePart.href, target: '_blank', rel: 'noopener noreferrer' };
}
</script>

<template>
	<nav :aria-label="t('modules')" data-testid="module-bar">
		<ul class="m-0 grid list-none grid-cols-3 gap-2 p-0">
			<li v-for="modulePart in mainModules" :key="modulePart.id">
				<BoTooltip :text="modulePart.name" side="bottom">
					<component
						:is="modulePart.to !== undefined ? RouterLink : 'a'"
						v-bind="linkProps(modulePart)"
						:aria-current="isActive(modulePart) ? 'page' : undefined"
						:class="itemClass(isActive(modulePart))"
					>
						<BoIcon :name="modulePart.icon" />
						<span class="sr-only">{{ modulePart.name }}</span>
					</component>
				</BoTooltip>
			</li>

			<li v-if="moreModules.length > 0" data-module-group="more">
				<BoMenu :items="moreItems" side="bottom" align="start">
					<template #trigger>
						<button type="button" :aria-label="t('links_and_extensions')" :class="itemClass(moreActive)">
							<BoIcon name="apps" />
						</button>
					</template>
				</BoMenu>
			</li>
		</ul>
	</nav>
</template>
