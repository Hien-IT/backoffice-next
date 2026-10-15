<!-- Ported from directus/app/src/modules/content/routes/preview.vue -->
<script setup lang="ts">
// Backoffice: no visual editing (Q1 = A), so no `saved` message to the opener; the version key comes from the
// `?version=` query until the versions of user story 4 (useVersions) are ported.
import { computed, toRefs } from 'vue';
import { useRoute } from 'vue-router';
import LivePreview from '../../../components/LivePreview.vue';
import { useCollection } from '../../../composables/use-collection.ts';
import { useTemplateData } from '../../../composables/use-template-data.ts';
import { renderStringTemplate } from '../../../utils/render-string-template.ts';

const props = defineProps<{
	collection: string;
	primaryKey: string;
}>();

const { collection, primaryKey } = toRefs(props);
const route = useRoute();

const { info: collectionInfo } = useCollection(collection);

const previewTemplate = computed(() => collectionInfo.value?.meta?.preview_url ?? '');

const { templateData: previewData } = useTemplateData(collectionInfo, primaryKey, {
	template: previewTemplate,
	injectData: computed(() => ({
		$version: typeof route.query['version'] === 'string' ? route.query['version'] : 'main',
	})),
});

const previewUrl = computed(() => {
	const { displayValue } = renderStringTemplate(previewTemplate.value, previewData.value);
	return displayValue.value || null;
});

function closePopup() {
	window.close();
}
</script>

<template>
	<LivePreview v-if="previewUrl" :url="previewUrl" in-popup @new-window="closePopup" />
</template>
