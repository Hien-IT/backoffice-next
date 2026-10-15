<!-- Ported from directus/app/src/views/private/components/module-bar-avatar.vue -->
<script setup lang="ts">
// Backoffice: the TailAdmin header user menu (layout-patterns §4, D-52): avatar and name open a menu with profile
// (/users/<id> like module-bar-avatar.vue, feature 015 FR-051) and sign out (/logout) instead of the avatar link plus the sign-out button with a confirm
// dialog; no notifications button (D-45); the avatar.modified_on cache buster is not fetched (not in
// contracts/api-calls).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoAvatar from '../components/BoAvatar.vue';
import BoIcon from '../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
import { useUserStore } from '../stores/user.ts';

const { t } = useI18n();

const userStore = useUserStore();

const avatarId = computed<string | null>(() => {
	const user = userStore.currentUser;
	if (!user || 'share' in user || !user.avatar) return null;
	return user.avatar.id;
});

const userFullName = computed(() => userStore.fullName ?? t('unknown_user'));

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
	<BoMenu :items="items" side="bottom" align="end">
		<template #trigger>
			<button
				type="button"
				:aria-label="userFullName"
				class="group flex items-center gap-3 rounded-full border-0 bg-transparent p-0 text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:focus-visible:outline-brand-400"
			>
				<BoAvatar :avatar-id="avatarId" :name="userFullName" />
				<span class="hidden max-w-48 truncate text-theme-sm font-medium sm:block">{{ userFullName }}</span>
				<BoIcon
					name="expand_more"
					size="sm"
					class="text-gray-500 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-gray-400"
				/>
			</button>
		</template>
	</BoMenu>
</template>
