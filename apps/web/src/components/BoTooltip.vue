<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';

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
					class="z-50 rounded-eh-sm bg-eh-neutral-900 px-eh-2 py-eh-1 text-eh-xs text-eh-neutral-0 shadow-eh-sm"
				>
					{{ text }}
				</TooltipContent>
			</TooltipPortal>
		</TooltipRoot>
	</TooltipProvider>
</template>
