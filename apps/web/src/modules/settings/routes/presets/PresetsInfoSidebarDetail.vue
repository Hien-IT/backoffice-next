<!-- Ported from directus/app/src/modules/settings/routes/presets/collection/components/presets-info-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: a `dl` in the SidebarDetail section like RoleInfoSidebarDetail. The request is apiFetch (the SDK keeps
// only `data` and drops `meta`); errors open the error dialog (showUnexpectedError, D-66).
import { ref } from 'vue';
import { apiFetch } from '../../../../api/sdk.ts';
import SidebarDetail from '../../../../components/sidebar/SidebarDetail.vue';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';

const loading = ref(false);
const bookmarksCount = ref<number | null>(null);
const presetsCount = ref<number | null>(null);

fetchCounts();

async function fetchCounts() {
	loading.value = true;

	try {
		const params = new URLSearchParams({
			'filter[bookmark][_nnull]': 'true',
			fields: 'id',
			meta: 'filter_count,total_count',
		});

		const response = await apiFetch(`/presets?${params}`);
		const body = await response.json();
		if (!response.ok) throw body;

		bookmarksCount.value = body.meta.filter_count as number;
		presetsCount.value = (body.meta.total_count as number) - bookmarksCount.value;
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<SidebarDetail id="presets" icon="info" :title="$t('information')">
		<dl class="m-0 flex flex-col gap-2 text-theme-sm">
			<div class="grid grid-cols-[7rem_1fr] items-center gap-x-3">
				<dt class="text-gray-500 dark:text-gray-400">{{ $t('bookmarks') }}</dt>
				<dd class="m-0 text-gray-800 dark:text-white/90">{{ bookmarksCount }}</dd>
			</div>
			<div class="grid grid-cols-[7rem_1fr] items-center gap-x-3">
				<dt class="text-gray-500 dark:text-gray-400">{{ $t('presets') }}</dt>
				<dd class="m-0 text-gray-800 dark:text-white/90">{{ presetsCount }}</dd>
			</div>
		</dl>
	</SidebarDetail>
</template>
