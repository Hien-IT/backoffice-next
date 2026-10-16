<!-- Ported from directus/app/src/modules/settings/routes/roles/role-info-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: a `dl` in the SidebarDetail section like UserInfoSidebarDetail (015); the copy button is a named icon
// button (an unnamed clickable icon in Directus) and reports the result through the in-place notice of useClipboard.
import type { Role } from '@directus/types';
import BoButton from '../../../../components/BoButton.vue';
import SidebarDetail from '../../../../components/sidebar/SidebarDetail.vue';
import { useClipboard } from '../../../../composables/use-clipboard.ts';

defineProps<{
	role: Role | null;
}>();

const { isCopySupported, copyToClipboard } = useClipboard();
</script>

<template>
	<SidebarDetail v-if="role" id="role" icon="info" :title="$t('information')">
		<dl class="m-0 flex flex-col gap-2 text-theme-sm">
			<div class="grid grid-cols-[7rem_1fr] items-center gap-x-3">
				<dt class="text-gray-500 dark:text-gray-400">{{ $t('primary_key') }}</dt>
				<dd class="m-0 flex min-w-0 items-center gap-1 text-gray-800 dark:text-white/90">
					<span class="min-w-0 break-all">{{ role.id }}</span>
					<BoButton
						v-if="isCopySupported"
						variant="ghost"
						icon="content_copy"
						class="clipboard-icon shrink-0"
						:aria-label="$t('copy_id')"
						:title="$t('copy_id')"
						@click="copyToClipboard(role.id)"
					/>
				</dd>
			</div>
		</dl>
	</SidebarDetail>
</template>
