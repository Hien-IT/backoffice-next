<!-- Ported from directus/app/src/views/private/components/module-bar-avatar.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-070, recipe Q-38): the notifications button of module-bar-avatar.vue (:56-65) as the round
// TailAdmin header button with a count badge instead of VBadge (hidden at 0, the button stays usable for the Archive
// tab; above 99 shows `99+`, the full number is in the accessible name). An sr-only `aria-live="polite"` region
// announces a changed count (Directus has none). No avatar or sign-out here: those are the UserMenu (D-45).
import { useEventListener, useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../components/BoIcon.vue';
import { useAppStore } from '../stores/app.ts';
import { useNotificationsStore } from '../stores/notifications.ts';

const { t } = useI18n();
const { notificationsDrawerOpen } = storeToRefs(useAppStore());
const { unread } = storeToRefs(useNotificationsStore());

// Only a change is announced, not the count on load.
const announcement = ref('');
watch(unread, (count) => (announcement.value = t('notifications_unread_count', { count })));

// Backoffice (D-116, owner 2026-10-18): Directus never refreshes the count by itself (R-52). Here it is recounted when
// the browser tab becomes visible again, at most once a minute (no polling while the tab stays open in front).
const notificationsStore = useNotificationsStore();
const recount = useThrottleFn(() => notificationsStore.refreshUnreadCount(), 60_000, false, true);
useEventListener(document, 'visibilitychange', () => {
	if (document.visibilityState === 'visible') recount();
});
</script>

<template>
	<button
		type="button"
		class="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:outline-brand-400"
		:aria-label="t('notifications_unread_count', { count: unread })"
		:title="t('notifications')"
		@click="notificationsDrawerOpen = true"
	>
		<BoIcon name="notifications" />
		<span
			v-if="unread > 0"
			aria-hidden="true"
			class="absolute -end-0.5 -top-0.5 h-5 min-w-5 rounded-full bg-error-600 px-1 text-center text-theme-xs leading-5 font-medium text-white"
			data-testid="notifications-badge"
		>
			{{ unread > 99 ? '99+' : unread }}
		</span>
	</button>
	<span class="sr-only" aria-live="polite">{{ announcement }}</span>
</template>
