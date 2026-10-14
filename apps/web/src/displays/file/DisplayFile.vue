<!-- Ported from directus/app/src/displays/file/file.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';

type File = {
	id: string;
	type: string;
	title: string;
	modified_on: Date;
};

const props = withDefaults(
	defineProps<{
		value?: File | null;
	}>(),
	{
		value: null,
	},
);

const previewEl = ref<Element>();
const imgError = ref(false);

const fileExtension = computed(() => {
	if (!props.value) return null;
	return readableMimeType(props.value.type, true);
});

const imageThumbnail = computed(() => {
	if (!props.value) return null;
	if (props.value.type?.includes('svg')) return getAssetUrl(props.value.id);
	if (props.value.type?.includes('image') === false) return null;

	return getAssetUrl(props.value.id, {
		imageKey: 'system-small-cover',
		cacheBuster: props.value.modified_on,
	});
});
</script>

<template>
	<!-- Backoffice: native lazy loading stands in for v-image's IntersectionObserver. -->
	<img
		v-if="imageThumbnail && !imgError"
		:src="imageThumbnail"
		loading="lazy"
		class="aspect-square h-full rounded-lg object-cover"
		:class="{ 'is-svg': value && value.type?.includes('svg') }"
		:alt="value?.title"
		@error="imgError = true"
	/>
	<div
		v-else
		ref="previewEl"
		class="preview relative inline-flex aspect-square h-full items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
	>
		<span v-if="fileExtension" class="extension text-theme-xs font-medium uppercase text-gray-700 dark:text-gray-400">
			{{ fileExtension }}
		</span>

		<BoIcon v-else name="folder_open" />
	</div>
</template>
