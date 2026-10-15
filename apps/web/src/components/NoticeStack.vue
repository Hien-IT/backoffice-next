<!-- Ported from directus/app/src/views/private/components/notification-dialogs.vue; Ported from directus/app/src/views/private/components/notifications-group.vue -->
<script setup lang="ts">
// Backoffice: the queue renders as in-place notices under the page header (D-66, recipe Q-8 of component-specs.md);
// errors that are not validation errors open a dialog with the error code and message, as Directus.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotices, type Notice } from '../composables/use-notices.ts';
import BoButton from './BoButton.vue';
import BoDialog from './BoDialog.vue';
import BoNotice from './BoNotice.vue';

const { t } = useI18n();
const { queue, dialogs, remove } = useNotices();

const NOTICE_TYPES = { info: 'info', success: 'success', warning: 'warning', error: 'danger' } as const;

const firstDialog = computed<Notice | undefined>(() => dialogs.value[0]);

function errorMessage(error: unknown): string | null {
	const list = (error as { errors?: { message?: string }[] } | null)?.errors;
	if (Array.isArray(list) && list[0]?.message) return list[0].message;
	if (error instanceof Error) return error.message;
	return null;
}
</script>

<template>
	<div v-if="queue.length > 0" class="mb-4 flex flex-col gap-2" role="status" aria-live="polite">
		<BoNotice v-for="notice in queue" :key="notice.id" :type="NOTICE_TYPES[notice.type ?? 'success']">
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<p class="m-0 font-medium text-gray-800 dark:text-white/90">{{ notice.title }}</p>
					<p v-if="notice.text" class="m-0 mt-1">{{ notice.text }}</p>
				</div>
				<BoButton variant="ghost" icon="close" :aria-label="t('dismiss')" @click="remove(notice.id)" />
			</div>
		</BoNotice>
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
