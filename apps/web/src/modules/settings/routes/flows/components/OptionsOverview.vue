<!-- Ported from directus/app/src/modules/settings/routes/flows/components/options-overview.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-022, recipe Q-30): the title (tooltip = the key) and the overview rows of the operation or
// trigger, as plain text; the copy button only when the browser can copy (use-clipboard, in-place notice D-45).
import type { FlowRaw } from '@directus/types';
import BoIcon from '../../../../../components/BoIcon.vue';
import { useClipboard } from '../../../../../composables/use-clipboard.ts';
import { translate } from '../../../../../utils/translate-object-values.ts';

defineProps<{
	panel: Record<string, any>;
	currentOperation: any;
	flow: FlowRaw;
}>();

const { isCopySupported, copyToClipboard } = useClipboard();
</script>

<template>
	<div
		class="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90"
		:title="panel['key']"
		data-panel-title
	>
		{{ panel['id'] === '$trigger' ? $t(`triggers.${panel['type']}.name`) : panel['name'] }}
	</div>
	<dl class="m-0 mt-2 flex flex-col gap-2">
		<div
			v-for="{ label, text, copyable } of translate(currentOperation?.overview(panel['options'] ?? {}, { flow }))"
			:key="label"
			class="relative min-w-0"
		>
			<dt class="text-theme-xs text-gray-500 dark:text-gray-400">{{ label }}</dt>
			<dd class="m-0 line-clamp-2 font-mono text-theme-sm break-all text-gray-700 dark:text-gray-300">{{ text }}</dd>
			<button
				v-if="isCopySupported && copyable"
				type="button"
				class="pointer-events-auto absolute end-0 top-0 inline-flex size-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5"
				:aria-label="`${$t('copy')} ${label}`"
				:title="text"
				@pointerdown.stop
				@click="copyToClipboard(text)"
			>
				<BoIcon name="content_copy" size="sm" />
			</button>
		</div>
	</dl>
</template>
