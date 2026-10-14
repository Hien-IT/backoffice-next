<!-- Ported from directus/app/src/views/private/components/module-bar-avatar.vue -->
<script setup lang="ts">
// Backoffice: the avatar opens a menu with profile (/users/me, FR-024) and sign out (/logout) instead of the
// avatar link plus the sign-out button with a confirm dialog; no notifications button (D-45); the avatar.modified_on
// cache buster is not fetched (not in contracts/api-calls).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoAvatar from '../components/BoAvatar.vue';
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

const userProfileLink = '/users/me';

const signOutLink = '/logout';

const items = computed<BoMenuItem[]>(() => {
	const user = userStore.currentUser;
	const signOut: BoMenuItem = { text: t('sign_out'), icon: 'logout', to: signOutLink };

	// Share users have no profile.
	if (!user || 'share' in user) return [signOut];

	return [{ text: t('profile'), icon: 'account_circle', to: userProfileLink }, signOut];
});
</script>

<template>
	<div class="flex justify-center">
		<BoMenu :items="items" side="right" align="end">
			<template #trigger>
				<button
					type="button"
					:aria-label="userFullName"
					class="flex cursor-pointer border-0 bg-transparent p-0 text-eh-text-primary"
				>
					<BoAvatar :avatar-id="avatarId" :name="userFullName" />
				</button>
			</template>
		</BoMenu>
	</div>
</template>
