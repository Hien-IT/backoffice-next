<!-- Ported from directus/app/src/modules/settings/routes/data-model/collections/collections.vue (download-snapshot sidebar detail) -->
<script setup lang="ts">
// Backoffice (spec 016 FR-016): the file holds the whole answer body `{ data }` of GET /schema/snapshot, indented by two
// spaces, named snapshot.json, as Directus `downloadSnapshot`. The SDK unwraps `data`, so it is wrapped again here.
import { saveAs } from 'file-saver';
import { requestEndpoint, sdk } from '../../../../../api/sdk.ts';
import BoButton from '../../../../../components/BoButton.vue';
import SidebarDetail from '../../../../../components/sidebar/SidebarDetail.vue';
import { showUnexpectedError } from '../../../../../composables/use-notices.ts';

async function downloadSnapshot() {
	try {
		const snapshot = await sdk.request(requestEndpoint('/schema/snapshot', { method: 'GET' }));

		saveAs(
			new Blob([JSON.stringify({ data: snapshot }, null, 2)], { type: 'application/json;charset=utf-8' }),
			'snapshot.json',
		);
	} catch (error) {
		showUnexpectedError(error);
	}
}
</script>

<template>
	<SidebarDetail id="download-snapshot" icon="download" :title="$t('snapshot.export')">
		<p class="m-0 mb-4 text-theme-sm text-gray-500 dark:text-gray-400">{{ $t('snapshot.info') }}</p>
		<BoButton variant="secondary" class="w-full" @click="downloadSnapshot">{{ $t('snapshot.download') }}</BoButton>
	</SidebarDetail>
</template>
