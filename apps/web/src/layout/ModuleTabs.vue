<script setup lang="ts">
// Backoffice (owner 2026-10-22, D-157): the module bar as horizontal tabs of the top bar (layout-patterns §2), in place
// of the module rows of the sidebar. Tabs follow the component-specs Tabs underline (brand-500 bar on the active one) and
// scroll sideways when they do not fit. The active module has aria-current; links to other sites open a new tab. The
// app extension modules stay one "Extensions" entry (D-144), here a tab with a menu of the modules.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
import { type ModuleBarItem, useModuleBar } from './composables/use-module-bar.ts';

const { t } = useI18n();
const { mainModules, extensionModules, isActive } = useModuleBar();

const extensionsActive = computed(() => extensionModules.value.some(isActive));
const extensionItems = computed<BoMenuItem[]>(() =>
	extensionModules.value.map((modulePart) => ({
		text: modulePart.name,
		icon: modulePart.icon,
		to: modulePart.to,
		active: isActive(modulePart),
	})),
);

const TAB =
	'flex h-full items-center gap-2 border-b-2 px-3 text-theme-sm font-medium whitespace-nowrap no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

function tabClass(active: boolean) {
	return [
		TAB,
		active
			? 'border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400'
			: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
	];
}

function linkProps(modulePart: ModuleBarItem) {
	return modulePart.to !== undefined
		? { to: modulePart.to }
		: { href: modulePart.href, target: '_blank', rel: 'noopener noreferrer' };
}
</script>

<template>
	<nav :aria-label="t('modules')" data-testid="module-bar" class="no-scrollbar h-full min-w-0 overflow-x-auto">
		<ul class="m-0 flex h-full list-none items-stretch gap-1 p-0">
			<li v-for="modulePart in mainModules" :key="modulePart.id">
				<component
					:is="modulePart.to !== undefined ? RouterLink : 'a'"
					v-bind="linkProps(modulePart)"
					:aria-current="isActive(modulePart) ? 'page' : undefined"
					:class="tabClass(isActive(modulePart))"
				>
					<BoIcon :name="modulePart.icon" size="sm" />
					<span>{{ modulePart.name }}</span>
					<template v-if="modulePart.href">
						<BoIcon name="open_in_new" size="sm" />
						<span class="sr-only">&#32;({{ t('open_in_new_window') }})</span>
					</template>
				</component>
			</li>

			<li v-if="extensionModules.length > 0" data-module-group="extensions">
				<BoMenu :items="extensionItems" side="bottom" align="start">
					<template #trigger>
						<button type="button" :class="tabClass(extensionsActive)">
							<BoIcon name="extension" size="sm" />
							<span>{{ t('extensions') }}</span>
							<BoIcon name="expand_more" size="sm" />
						</button>
					</template>
				</BoMenu>
			</li>
		</ul>
	</nav>
</template>
