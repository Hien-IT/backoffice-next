<!-- Ported from directus/app/src/modules/users/components/user-info-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: user story 4 of feature 015 (FR-074): a `dl` in the SidebarDetail section like the file details (Q-15);
// the copy button is a named icon button (an unnamed clickable icon in DR) and reports the result through the
// in-place notice of useClipboard.
import type { User } from '@directus/types';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import SidebarDetail from '../../../components/sidebar/SidebarDetail.vue';
import { useClipboard } from '../../../composables/use-clipboard.ts';
import { localizedFormat } from '../../../utils/localized-format.ts';

const props = defineProps<{
	user: User | null;
	isNew?: boolean;
}>();

const { t } = useI18n();

const { isCopySupported, copyToClipboard } = useClipboard();

const lastAccessDate = ref('');

watch(
	[() => props.user, () => props.isNew],
	async () => {
		if (!props.user) return;

		if (props.user.last_access) {
			lastAccessDate.value = localizedFormat(new Date(props.user.last_access), String(t('date-fns_date_short')));
		}
	},
	{ immediate: true },
);

const ROW = 'grid grid-cols-[7rem_1fr] gap-x-3';
const DT = 'text-gray-500 dark:text-gray-400';
const DD = 'm-0 min-w-0 break-words text-gray-800 dark:text-white/90';
const LINK = 'text-brand-500 underline-offset-2 hover:underline dark:text-brand-400';
</script>

<template>
	<SidebarDetail id="user-info" icon="info" :title="$t('information')">
		<dl v-if="isNew === false && user" class="m-0 flex flex-col gap-2 text-theme-sm">
			<div v-if="user.id" :class="ROW" class="items-center">
				<dt :class="DT">{{ $t('key') }}</dt>
				<dd :class="DD" class="flex items-center gap-1">
					<span class="min-w-0 break-all">{{ user.id }}</span>
					<BoButton
						v-if="isCopySupported"
						variant="ghost"
						icon="content_copy"
						class="clipboard-icon shrink-0"
						:aria-label="$t('copy_id')"
						:title="$t('copy_id')"
						@click="copyToClipboard(user.id)"
					/>
				</dd>
			</div>
			<div v-if="user.last_page" :class="ROW">
				<dt :class="DT">{{ $t('last_page') }}</dt>
				<dd :class="DD">
					<RouterLink :to="user.last_page" :class="LINK">{{ user.last_page }}</RouterLink>
				</dd>
			</div>
			<div v-if="user.last_access" :class="ROW">
				<dt :class="DT">{{ $t('last_access') }}</dt>
				<dd :class="DD">{{ lastAccessDate }}</dd>
			</div>
		</dl>
	</SidebarDetail>
</template>
