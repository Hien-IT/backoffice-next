<!-- Ported from directus/app/src/views/private/components/share-item.vue -->
<script setup lang="ts">
// Backoffice: recipe "Comments and shares" (Q-11): name, uses left and status `text-theme-xs`, a `lock` icon with a label
// when password protected, used up and expired in error, upcoming in success; the menu is a BoMenu (no divider). The
// role is not shown: the `/shares` request is the one of DR (no `role.name` field). A share without date_created shows no date.
import type { Share } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useItemPermissions } from '../../composables/use-permissions/index.ts';
import { localizedFormat } from '../../utils/localized-format.ts';
import BoIcon from '../BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';

const props = defineProps<{
	share: Share;
}>();

const emit = defineEmits<{
	copy: [];
	edit: [];
	invite: [];
	delete: [];
}>();

const { t } = useI18n();

const { updateAllowed, deleteAllowed } = useItemPermissions('directus_shares', props.share.id, false);

const usesLeft = computed(() => {
	if (props.share.max_uses === null) return null;
	return props.share.max_uses - props.share.times_used;
});

const status = computed(() => {
	if (props.share.date_end && new Date(props.share.date_end) < new Date()) {
		return 'expired';
	}

	if (props.share.date_start && new Date(props.share.date_start) > new Date()) {
		return 'upcoming';
	}

	return null;
});

const formattedTime = computed(() =>
	props.share.date_created
		? localizedFormat(new Date(props.share.date_created), String(t('date-fns_date_short')))
		: null,
);

const menuItems = computed<BoMenuItem[]>(() => [
	{ text: t('share_copy_link'), icon: 'content_copy', onSelect: () => emit('copy') },
	{ text: t('share_send_link'), icon: 'send', onSelect: () => emit('invite') },
	...(updateAllowed.value ? [{ text: t('edit'), icon: 'edit', onSelect: () => emit('edit') }] : []),
	...(deleteAllowed.value ? [{ text: t('delete_label'), icon: 'delete', onSelect: () => emit('delete') }] : []),
]);
</script>

<template>
	<article class="flex flex-col gap-1 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
		<div class="flex items-center gap-2">
			<span class="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
				{{ share.name }}
			</span>

			<span v-if="formattedTime" class="shrink-0 text-theme-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
				{{ formattedTime }}
			</span>

			<BoMenu :items="menuItems" align="end">
				<template #trigger>
					<button
						type="button"
						class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
						:aria-label="$t('item_options', { item: share.name })"
					>
						<BoIcon name="more_horiz" size="sm" />
					</button>
				</template>
			</BoMenu>
		</div>

		<div class="flex items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
			<span :class="{ 'text-error-600 dark:text-error-400': usesLeft === 0 }">
				<template v-if="usesLeft === null">{{ $t('unlimited_usage') }}</template>
				<template v-else>{{ $t('uses_left', usesLeft) }}</template>
			</span>

			<BoIcon v-if="share.password" name="lock" size="sm" :label="$t('password')" />

			<span class="flex-1" />

			<span
				v-if="status"
				class="font-semibold uppercase"
				:class="status === 'expired' ? 'text-error-600 dark:text-error-400' : 'text-success-600 dark:text-success-500'"
			>
				{{ $t(status) }}
			</span>
		</div>
	</article>
</template>
