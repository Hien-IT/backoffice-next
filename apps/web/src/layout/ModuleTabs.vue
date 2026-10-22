<script setup lang="ts">
// Backoffice (owner 2026-10-22, D-157): the module bar as a grid of tiles in the project color block of the sidebar
// (AppSidebar, layout-patterns §2), after the owner's mock-up (2026-10-22): an icon per module with its name under it.
// The active module has aria-current and the white tile. The module_bar links (Add Link) and the app extension modules (D-144) share one tile with a menu
// (owner 2026-10-22, D-162), in module_bar order; links to other sites open a new tab from it.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
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
	'flex w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-theme-xs font-medium no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

function itemClass(active: boolean) {
	return [
		ITEM,
		active
			? 'bg-white text-gray-800 shadow-theme-sm ring-2 ring-white/60'
			: 'bg-white/10 text-white hover:bg-white/20',
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
				<component
					:is="modulePart.to !== undefined ? RouterLink : 'a'"
					v-bind="linkProps(modulePart)"
					:aria-current="isActive(modulePart) ? 'page' : undefined"
					:title="modulePart.name"
					:class="itemClass(isActive(modulePart))"
				>
					<BoIcon :name="modulePart.icon" />
					<span class="w-full truncate text-center">{{ modulePart.name }}</span>
				</component>
			</li>

			<li v-if="moreModules.length > 0" data-module-group="more">
				<BoMenu :items="moreItems" side="bottom" align="start">
					<template #trigger>
						<button type="button" :title="t('links_and_extensions')" :class="itemClass(moreActive)">
							<BoIcon name="apps" />
							<!-- Name "More: Links and extensions": it starts with the visible label (WCAG 2.5.3). -->
							<span class="w-full truncate text-center">{{ t('more_modules') }}</span>
							<span class="sr-only">: {{ t('links_and_extensions') }}</span>
						</button>
					</template>
				</BoMenu>
			</li>
		</ul>
	</nav>
</template>
