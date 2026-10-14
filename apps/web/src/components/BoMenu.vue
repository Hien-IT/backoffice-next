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
				class="z-50 rounded-eh-md border border-eh-border bg-eh-surface-default p-eh-1 shadow-eh-sm"
			>
				<DropdownMenuItem
					v-for="item in items"
					:key="item.text"
					:as-child="item.to !== undefined"
					class="flex cursor-pointer items-center gap-eh-2 whitespace-nowrap rounded-eh-sm px-eh-3 py-eh-2 text-eh-sm text-eh-text-primary no-underline outline-none data-highlighted:bg-eh-surface-subtle"
					@select="item.onSelect?.()"
				>
					<RouterLink v-if="item.to !== undefined" :to="item.to">
						<BoIcon v-if="item.icon" :name="item.icon" size="sm" />
						{{ item.text }}
					</RouterLink>
					<template v-else>
						<BoIcon v-if="item.icon" :name="item.icon" size="sm" />
						{{ item.text }}
					</template>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
