<script setup lang="ts">
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuTrigger,
} from 'reka-ui';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import BoIcon from './BoIcon.vue';

export type BoMenuItem = { text: string; icon?: string; to?: RouteLocationRaw; onSelect?: () => void };

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
				<DropdownMenuItem
					v-for="item in items"
					:key="item.text"
					:as-child="item.to !== undefined"
					class="flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300"
					@select="item.onSelect?.()"
				>
					<RouterLink v-if="item.to !== undefined" :to="item.to">
						<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
						{{ item.text }}
					</RouterLink>
					<template v-else>
						<BoIcon v-if="item.icon" :name="item.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
						{{ item.text }}
					</template>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
