<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';

// The default slot is the trigger and must be one element (as-child). The provider is included so the tooltip
// works anywhere without an app-level TooltipProvider.
const { side = 'top' } = defineProps<{ text: string; side?: 'top' | 'right' | 'bottom' | 'left' }>();
</script>

<template>
	<TooltipProvider>
		<TooltipRoot>
			<TooltipTrigger as-child>
				<slot />
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent
					:side="side"
					:side-offset="4"
					class="z-99999 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-theme-xs font-medium text-white shadow-tooltip dark:bg-gray-800 dark:text-white/90"
				>
					{{ text }}
					<TooltipArrow class="fill-gray-900 dark:fill-gray-800" />
				</TooltipContent>
			</TooltipPortal>
		</TooltipRoot>
	</TooltipProvider>
</template>
