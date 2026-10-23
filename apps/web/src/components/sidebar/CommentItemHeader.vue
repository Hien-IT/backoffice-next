<!-- Ported from directus/app/src/views/private/components/comment-item-header.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11): avatar xs, name, time and a BoMenu (edit, delete) that stays visible
// (DR swaps the time for the menu on hover); the delete confirmation is a BoDialog with Cancel first. axios -> sdk.
import type { Comment, User } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import type { AppUser } from '../../types/user.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { localizedFormat } from '../../utils/localized-format.ts';
import { userName } from '../../utils/user-name.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoIcon from '../BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';
import UserPopover from '../render/UserPopover.vue';

const props = defineProps<{
	comment: Comment & {
		display: string;
		user_created: Pick<User, 'id' | 'email' | 'first_name' | 'last_name' | 'avatar'>;
	};
	refresh: () => Promise<void>;
}>();

const emit = defineEmits<{ edit: [] }>();

const { t } = useI18n();

const name = computed(() =>
	props.comment.user_created ? userName(props.comment.user_created as Partial<AppUser>) : t('private_user'),
);

const formattedTime = computed(() => {
	if (props.comment.date_created) {
		// timestamp is in iso-8601
		return localizedFormat(new Date(props.comment.date_created), String(t('date-fns_time_no_seconds')));
	}

	return null;
});

const avatarSource = computed(() => {
	const avatar = props.comment.user_created?.avatar as { id: string; modified_on?: string | null } | null | undefined;
	if (!avatar) return null;

	return getAssetUrl(avatar.id, { imageKey: 'system-small-cover', cacheBuster: avatar.modified_on ?? false });
});

const { confirmDelete, deleting, remove } = useDelete();

const menuItems = computed<BoMenuItem[]>(() => [
	{ text: t('edit'), icon: 'edit', onSelect: () => emit('edit') },
	{ text: t('delete_label'), icon: 'delete', onSelect: () => (confirmDelete.value = true) },
]);

function useDelete() {
	const confirmDelete = ref(false);
	const deleting = ref(false);

	return { confirmDelete, deleting, remove };

	async function remove() {
		if (deleting.value) return;
		deleting.value = true;

		try {
			await sdk.request(requestEndpoint(`/comments/${props.comment.id}`, { method: 'DELETE' }));
			await props.refresh();
			confirmDelete.value = false;
		} catch (error) {
			showUnexpectedError(error);
		} finally {
			deleting.value = false;
		}
	}
}
</script>

<template>
	<div class="flex items-center gap-2">
		<span
			class="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
		>
			<img v-if="avatarSource" :src="avatarSource" :alt="name" class="size-full object-cover" />
			<BoIcon v-else name="person" size="sm" />
		</span>

		<div class="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
			<UserPopover v-if="comment.user_created && comment.user_created.id" :user="comment.user_created.id">
				<span class="truncate">{{ name }}</span>
			</UserPopover>
			<span v-else>{{ $t('private_user') }}</span>
		</div>

		<span
			v-if="formattedTime"
			class="shrink-0 text-theme-xs whitespace-nowrap text-gray-500 lowercase dark:text-gray-400"
		>
			{{ formattedTime }}
		</span>

		<BoMenu :items="menuItems" align="end">
			<template #trigger>
				<button
					type="button"
					class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
					:aria-label="$t('item_options', { item: name })"
				>
					<BoIcon name="more_horiz" size="sm" />
				</button>
			</template>
		</BoMenu>

		<BoDialog
			:open="confirmDelete"
			:title="$t('delete_comment')"
			:description="$t('delete_are_you_sure')"
			@update:open="confirmDelete = $event"
		>
			<template #actions>
				<BoButton variant="secondary" @click="confirmDelete = false">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="deleting" @click="remove">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
