<script setup lang="ts">
// Backoffice (owner 2026-10-21, D-132): the TailAdmin notification panel under the bell (layout-patterns §4), in front
// of the notifications drawer of 018: the latest inbox notifications of the user, each with a "mark as read" button,
// "mark all as read", and "View all" opening the drawer (filters, search, archive tab, delete). Read is the Directus
// `archived` status (no read flag in directus_notifications); mark all is one PATCH by query, as the REST API allows.
// Loaded when the panel opens (mounted with the popover content), not polled.
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { showUnexpectedError } from '../composables/use-notices.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useUserStore } from '../stores/user.ts';
import { formatDate } from '../utils/format-date.ts';
import { notificationTarget } from '../utils/notification-target.ts';
import BoButton from './BoButton.vue';
import BoIcon from './BoIcon.vue';
import BoProgressCircular from './BoProgressCircular.vue';

type PanelNotification = {
	id: string | number;
	subject: string;
	collection: string | null;
	item: string | null;
	timestamp: string;
};

const emit = defineEmits<{ close: []; viewAll: [] }>();

/** Rows shown; the unread count of the store says how many there are in all. */
const LIMIT = 10;

const { t } = useI18n();
const notificationsStore = useNotificationsStore();
const userStore = useUserStore();

const notifications = ref<PanelNotification[]>([]);
const loading = ref(true);
const saving = ref(false);

function inboxFilter() {
	const user = userStore.currentUser;
	return {
		_and: [{ recipient: { _eq: user && 'id' in user ? user.id : null } }, { status: { _eq: 'inbox' } }],
	};
}

async function load() {
	try {
		notifications.value = await sdk.request(
			requestEndpoint<PanelNotification[]>('/notifications', {
				method: 'GET',
				params: {
					filter: inboxFilter(),
					fields: ['id', 'subject', 'collection', 'item', 'timestamp'],
					sort: ['-timestamp'],
					limit: LIMIT,
				},
			}),
		);
	} catch (err) {
		showUnexpectedError(err);
	} finally {
		loading.value = false;
	}
}

async function markRead(body: Record<string, unknown>) {
	saving.value = true;
	try {
		await sdk.request(
			requestEndpoint('/notifications', { method: 'PATCH', body: { ...body, data: { status: 'archived' } } }),
		);
		await Promise.all([load(), notificationsStore.refreshUnreadCount()]);
	} catch (err) {
		showUnexpectedError(err);
	} finally {
		saving.value = false;
	}
}

const markOne = (notification: PanelNotification) => markRead({ keys: [notification.id] });
const markAll = () => markRead({ query: { filter: inboxFilter(), limit: -1 } });

const time = (timestamp: string) =>
	formatDate(timestamp, {
		type: 'timestamp',
		format: 'long',
		relative: true,
		strict: false,
		round: 'round',
		suffix: true,
	});

const ICON_BTN =
	'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

// Opening the panel also recounts, so the badge matches the list (changes made elsewhere since the last count).
onMounted(() => Promise.all([load(), notificationsStore.refreshUnreadCount().catch(() => {})]));
</script>

<template>
	<div class="flex max-h-120 w-87.5 max-w-[calc(100vw-2rem)] flex-col">
		<div class="flex items-center justify-between gap-3 border-b border-gray-100 px-2 pb-3 dark:border-gray-800">
			<h2 class="m-0 text-lg font-semibold text-gray-800 dark:text-white/90">{{ t('notifications') }}</h2>
			<BoButton
				variant="ghost"
				:disabled="saving || notifications.length === 0"
				data-testid="notifications-mark-all"
				@click="markAll"
			>
				{{ t('notifications_mark_all_read') }}
			</BoButton>
		</div>

		<div v-if="loading" class="flex justify-center py-8">
			<BoProgressCircular indeterminate :aria-label="t('loading')" />
		</div>
		<p
			v-else-if="notifications.length === 0"
			class="m-0 px-2 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400"
		>
			{{ t('no_notifications') }}
		</p>
		<ul v-else class="custom-scrollbar m-0 flex list-none flex-col overflow-y-auto p-0">
			<li
				v-for="notification in notifications"
				:key="notification.id"
				class="flex items-center gap-3 rounded-lg border-b border-gray-100 px-2 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
			>
				<span aria-hidden="true" class="size-2 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400" />
				<component
					:is="notificationTarget(notification) ? RouterLink : 'div'"
					v-bind="notificationTarget(notification) ? { to: notificationTarget(notification) } : {}"
					class="min-w-0 flex-1 rounded text-start no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
					@click="notificationTarget(notification) && emit('close')"
				>
					<span
						class="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90"
						:title="notification.subject"
					>
						{{ notification.subject }}
					</span>
					<span class="block text-theme-xs text-gray-500 dark:text-gray-400">{{ time(notification.timestamp) }}</span>
				</component>
				<button
					type="button"
					:class="ICON_BTN"
					:disabled="saving"
					:aria-label="`${t('notifications_mark_read')}: ${notification.subject}`"
					:title="t('notifications_mark_read')"
					@click="markOne(notification)"
				>
					<BoIcon name="done" size="sm" />
				</button>
			</li>
		</ul>

		<div class="pt-3">
			<BoButton variant="secondary" full-width @click="emit('viewAll')">{{ t('notifications_view_all') }}</BoButton>
		</div>
	</div>
</template>
