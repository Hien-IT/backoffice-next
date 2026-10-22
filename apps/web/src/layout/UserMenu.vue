<!-- Ported from directus/app/src/views/private/components/module-bar-avatar.vue -->
<script setup lang="ts">
// Backoffice: the user menu at the bottom of the module rail like Directus module-bar-avatar.vue (owner 2026-10-22,
// D-157; under the sidebar logo from 2026-10-20, the TailAdmin header menu before, layout-patterns §4, D-52): the avatar,
// named after the user, opens a menu with profile
// (/users/<id> like module-bar-avatar.vue, feature 015 FR-051) and sign out (/logout) instead of the avatar link plus the sign-out button with a confirm
// dialog; the avatar.modified_on cache buster is not fetched (not in contracts/api-calls).
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoAvatar from '../components/BoAvatar.vue';
import BoMenu, { type BoMenuItem } from '../components/BoMenu.vue';
import { useUserStore } from '../stores/user.ts';

const open = defineModel<boolean>('open', { default: false });

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
	<BoMenu v-model:open="open" :items="items" side="right" align="end">
		<template #trigger>
			<button
				type="button"
				:aria-label="userFullName"
				class="flex rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<BoAvatar :avatar-id="avatarId" :name="userFullName" small />
			</button>
		</template>
	</BoMenu>
</template>
