<script lang="ts">
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

/** EditorFrame toolbar button: `ICON_BTN` + the "on" state of a toggle (`data-state=on` or `aria-pressed`). */
export const EDITOR_TOOLBAR_BUTTON = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-brand-50 data-[state=on]:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:data-[state=on]:bg-brand-500/15 dark:data-[state=on]:text-brand-400 ${FOCUS}`;
</script>

<script setup lang="ts">
// component-specs EditorFrame (nháp, 013), shared by the code, markdown and block editors: the FIELD border on the
// frame, an optional Reka toolbar row (one Tab stop, arrows move) and the Directus `softLength` counter under the
// frame (thresholds of utils/percentage.ts: warning below 10 %, danger below 5 % remaining).
import { ToolbarRoot } from 'reka-ui';
import { computed, useId } from 'vue';

const props = defineProps<{
	invalid?: boolean | undefined;
	disabled?: boolean | undefined;
	/** `aria-label` of the toolbar. */
	toolbarLabel?: string | undefined;
	/** Id of the editor the toolbar acts on (`aria-controls`). */
	controls?: string | undefined;
	softLength?: number | undefined;
	/** Current length counted against `softLength`. */
	count?: number | undefined;
	/** Id of the counter, for the editor's `aria-describedby`. */
	counterId?: string | undefined;
}>();

const fallbackId = useId();
const counterId = computed(() => props.counterId ?? fallbackId);

const remaining = computed(() => (props.softLength ? Number(props.softLength) - (props.count ?? 0) : null));

// directus/app/src/utils/percentage.ts (null when no limit read as 100).
const percRemaining = computed(() => {
	if (!props.softLength) return 100;
	if (!props.count) return 100;
	return 100 - (props.count / Number(props.softLength)) * 100;
});
</script>

<template>
	<div>
		<div
			class="bo-editor-frame overflow-hidden rounded-lg border shadow-theme-xs"
			:class="
				disabled
					? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]'
					: invalid
						? 'border-error-600 bg-transparent focus-within:border-error-600 focus-within:ring-3 focus-within:ring-error-500/10 dark:border-error-400 dark:bg-gray-900'
						: 'border-gray-300 bg-transparent focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-brand-400'
			"
			:data-invalid="invalid || undefined"
			:data-disabled="disabled || undefined"
		>
			<ToolbarRoot
				v-if="$slots['toolbar']"
				:aria-label="toolbarLabel"
				:aria-controls="controls"
				class="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.03]"
			>
				<slot name="toolbar" />
			</ToolbarRoot>
			<slot />
		</div>
		<p
			v-if="softLength"
			:id="counterId"
			data-remaining
			class="mt-1.5 flex justify-end text-theme-xs tabular-nums"
			:class="
				percRemaining < 5
					? 'text-error-600 dark:text-error-400'
					: percRemaining < 10
						? 'text-warning-700 dark:text-warning-400'
						: 'text-gray-500 dark:text-gray-400'
			"
		>
			{{ remaining }}
		</p>
	</div>
</template>
