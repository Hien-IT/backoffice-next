<!-- Ported from directus/app/src/views/private/components/module-bar-avatar.vue -->
<script setup lang="ts">
// Backoffice: the user menu, under the sidebar logo since 2026-10-20 (owner; was the TailAdmin header menu,
// layout-patterns §4, D-52): avatar and name open a menu with profile
// (/users/<id> like module-bar-avatar.vue, feature 015 FR-051) and sign out (/logout) instead of the avatar link plus the sign-out button with a confirm
// dialog; the avatar.modified_on cache buster is not fetched (not in contracts/api-calls). On the collapsed rail the
// bell folds into the avatar (owner 2026-10-21): its unread badge on the avatar. The rail expands on hover and on
// keyboard focus, and stays expanded while this menu is open (`open` model), so the bell itself is there to click.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoAvatar from '../components/BoAvatar.vue';
import BoIcon from '../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useUserStore } from '../stores/user.ts';

const { collapsed = false } = defineProps<{ collapsed?: boolean }>();
const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();

const userStore = useUserStore();
const { unread } = storeToRefs(useNotificationsStore());

const avatarId = computed<string | null>(() => {
	const user = userStore.currentUser;
	if (!user || 'share' in user || !user.avatar) return null;
	return user.avatar.id;
});

const userFullName = computed(() => userStore.fullName ?? t('unknown_user'));

const showBadge = computed(() => collapsed && unread.value > 0);
const triggerLabel = computed(() =>
	showBadge.value
		? `${userFullName.value}, ${t('notifications_unread_count', { count: unread.value })}`
		: userFullName.value,
);

const signOutLink = '/logout';

const items = computed<BoMenuItem[]>(() => {
	const user = userStore.currentUser;
	const signOut: BoMenuItem = { text: t('sign_out'), icon: 'logout', to: signOutLink };

	// Share users have no profile.
	if (!user || 'share' in user) return [signOut];

	return [{ text: t('profile'), icon: 'account_circle', to: `/users/${user.id}` }, signOut];
});
</script>

<template>
	<BoMenu v-model:open="open" :items="items" side="bottom" align="start">
		<template #trigger>
			<button
				type="button"
				:aria-label="triggerLabel"
				class="group flex min-w-10 items-center gap-3 rounded-full border-0 bg-transparent p-0 text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:focus-visible:outline-brand-400"
			>
				<span class="relative flex">
					<BoAvatar :avatar-id="avatarId" :name="userFullName" small />
					<!-- The bell badge (NotificationsBell.vue) on the rail; the count is in the trigger name. -->
					<span
						v-if="showBadge"
						aria-hidden="true"
						class="absolute -end-1 -top-1 h-5 min-w-5 rounded-full bg-error-600 px-1 text-center text-theme-xs leading-5 font-medium text-white"
						data-testid="notifications-badge"
					>
						{{ unread > 99 ? '99+' : unread }}
					</span>
				</span>
				<template v-if="!collapsed">
					<span class="truncate text-theme-sm font-medium">{{ userFullName }}</span>
					<BoIcon
						name="expand_more"
						size="sm"
						class="shrink-0 text-gray-500 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400"
					/>
				</template>
			</button>
		</template>
	</BoMenu>
</template>
