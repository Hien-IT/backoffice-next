<!-- Ported from directus/app/src/views/private/components/notification-dialogs.vue; Ported from directus/app/src/views/private/components/notifications-group.vue -->
<script setup lang="ts">
// Backoffice: the queue renders as toasts at the bottom end of the screen like the DR notifications-group (owner
// 2026-10-23, D-172 replaces the in-place notices of D-66): opaque cards (recipe Toast of component-specs.md), the
// type in the icon and a start border. Errors that are not validation errors open a dialog with the error code and
// message, as DR.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotices, type Notice } from '../composables/use-notices.ts';
import BoButton from './BoButton.vue';
import BoDialog from './BoDialog.vue';
import BoIcon from './BoIcon.vue';

const { t } = useI18n();
const { queue, dialogs, remove } = useNotices();

// Icons as v-notice, colors from the component-specs Alert recipe.
const TOAST_TYPES = {
	info: {
		icon: 'info',
		accent: 'border-s-blue-light-500 dark:border-s-blue-light-500',
		color: 'text-blue-light-600 dark:text-blue-light-500',
	},
	success: {
		icon: 'check_circle',
		accent: 'border-s-success-500 dark:border-s-success-500',
		color: 'text-success-600 dark:text-success-500',
	},
	warning: {
		icon: 'warning',
		accent: 'border-s-warning-500 dark:border-s-warning-500',
		color: 'text-warning-600 dark:text-warning-500',
	},
	error: {
		icon: 'error',
		accent: 'border-s-error-500 dark:border-s-error-500',
		color: 'text-error-600 dark:text-error-500',
	},
} as const;

const firstDialog = computed<Notice | undefined>(() => dialogs.value[0]);

/** DR notification-item: a dismiss action replaces closing the notice. */
async function dismiss(notice: Notice) {
	if (notice.dismissAction) await notice.dismissAction();
	else remove(notice.id);
}

function errorMessage(error: unknown): string | null {
	const list = (error as { errors?: { message?: string }[] } | null)?.errors;
	if (Array.isArray(list) && list[0]?.message) return list[0].message;
	if (error instanceof Error) return error.message;
	return null;
}
</script>

<template>
	<!-- Always in the page so screen readers announce the first notice too (design owner, recipe Q-8, 2026-10-15). Fixed
	     above drawers and dialogs like the DR `.overlay` group; full width below sm. -->
	<div
		class="pointer-events-none fixed inset-x-4 bottom-4 z-999999 flex flex-col items-end gap-2 sm:start-auto sm:end-6 sm:bottom-6 sm:w-80"
		role="status"
		aria-live="polite"
	>
		<TransitionGroup
			enter-from-class="translate-x-4 opacity-0"
			leave-to-class="translate-x-4 opacity-0"
			enter-active-class="motion-safe:transition motion-safe:duration-200"
			leave-active-class="motion-safe:transition motion-safe:duration-150"
		>
			<div
				v-for="notice in queue"
				:key="notice.id"
				data-notice
				class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-s-4 border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
				:class="TOAST_TYPES[notice.type ?? 'success'].accent"
			>
				<BoIcon
					:name="notice.icon ?? TOAST_TYPES[notice.type ?? 'success'].icon"
					class="mt-0.5"
					:class="TOAST_TYPES[notice.type ?? 'success'].color"
				/>
				<div class="min-w-0 flex-1 py-0.5 text-sm text-gray-500 dark:text-gray-400">
					<p class="m-0 font-medium text-gray-800 dark:text-white/90">{{ notice.title }}</p>
					<p v-if="notice.text" class="m-0 mt-1">{{ notice.text }}</p>
				</div>
				<BoButton
					v-if="notice.dismissText"
					variant="ghost"
					size="sm"
					v-bind="notice.dismissIcon ? { icon: notice.dismissIcon } : {}"
					@click="dismiss(notice)"
				>
					{{ notice.dismissText }}
				</BoButton>
				<BoButton
					v-else-if="notice.closeable !== false"
					variant="ghost"
					size="sm"
					:icon="notice.dismissIcon ?? 'close'"
					:aria-label="t('dismiss')"
					@click="dismiss(notice)"
				/>
			</div>
		</TransitionGroup>
	</div>

	<BoDialog
		v-if="firstDialog"
		:key="firstDialog.id"
		:open="true"
		:title="firstDialog.title"
		@update:open="(open: boolean) => !open && remove(firstDialog!.id)"
	>
		<p v-if="firstDialog.text" class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ firstDialog.text }}</p>
		<pre
			v-if="firstDialog.error"
			class="m-0 mt-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-theme-xs whitespace-pre-wrap text-gray-700 dark:bg-white/5 dark:text-gray-400"
		>
[{{ firstDialog.code }}] {{ errorMessage(firstDialog.error) ?? '' }}</pre
		>
		<template #actions>
			<BoButton @click="remove(firstDialog!.id)">{{ t('dismiss') }}</BoButton>
		</template>
	</BoDialog>
</template>
