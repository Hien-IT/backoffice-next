<script setup lang="ts">
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';

// `to` = router link, `href` = external link in a new tab, `loading` = spinner in place of the text (screen readers
// still get the text).
export type BoMenuItem = {
	text: string;
	icon?: string | undefined;
	to?: RouteLocationRaw | undefined;
	href?: string | undefined;
	disabled?: boolean;
	loading?: boolean;
	onSelect?: () => void;
	/** The current choice of a pick-one menu (feature 015, aspect ratios): a check and `aria-checked`. */
	active?: boolean;
	/** A separator after this item. */
	divider?: boolean;
};

// Slot `trigger` is one focusable element (as-child); Reka returns focus to it when the menu closes.
const { side = 'bottom', align = 'start' } = defineProps<{
	items: BoMenuItem[];
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
}>();
</script>

<template>
	<DropdownMenuRoot>
		<DropdownMenuTrigger as-child>
			<slot name="trigger" />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent
				:side="side"
				:align="align"
				:side-offset="4"
				class="z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
			>
				<template v-for="(item, index) in items" :key="index">
					<DropdownMenuItem
						:as-child="item.to !== undefined || !!item.href"
						v-bind="item.active === undefined ? {} : { role: 'menuitemradio', 'aria-checked': item.active }"
						:disabled="!!item.disabled"
						class="flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300"
						@select="item.onSelect?.()"
					>
						<component
							:is="item.to !== undefined ? RouterLink : 'a'"
							v-if="item.to !== undefined || item.href"
							v-bind="
								item.to !== undefined
									? { to: item.to }
									: { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
							"
						>
							<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ item.text }}
						</component>
						<template v-else>
							<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
							<template v-if="item.loading">
								<BoProgressCircular indeterminate aria-hidden="true" />
								<span class="sr-only">{{ item.text }}</span>
							</template>
							<template v-else>{{ item.text }}</template>
							<BoIcon v-if="item.active" name="check" size="sm" class="ms-auto text-brand-500 dark:text-brand-400" />
						</template>
					</DropdownMenuItem>
					<DropdownMenuSeparator v-if="item.divider" class="my-1 h-px bg-gray-200 dark:bg-gray-800" />
				</template>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
