<!-- Ported from directus/app/src/components/v-image.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): new, as Directus: an empty pixel until the image enters the viewport, then
// `src` loads through the request queue; every other attribute goes to the `img`.
import { omit } from 'lodash-es';
import { computed, onMounted, onUnmounted, ref, useAttrs, watch } from 'vue';
import { requestQueue } from '../../api/sdk.ts';

defineOptions({
	inheritAttrs: false,
});

const props = defineProps<{
	src: string;
}>();

const attrs = useAttrs();

const imageElement = ref<HTMLImageElement>();

const emptyPixel =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const srcData = ref<string>(emptyPixel);

const observer = new IntersectionObserver((entries, observer) => {
	if (entries.length === 0) return;

	const isIntersecting = entries.at(-1)!.isIntersecting;

	if (isIntersecting && props.src) {
		observer.disconnect();
		loadImage();
	}
});

watch(
	() => props.src,
	() => loadImage(),
);

function loadImage() {
	requestQueue.add(() => {
		srcData.value = props.src;
	});
}

onMounted(() => {
	if (!imageElement.value) return;
	observer.observe(imageElement.value);
});

onUnmounted(() => {
	observer.disconnect();
});

const attrsWithoutSrc = computed(() => omit(attrs, ['src']));
</script>

<template>
	<img ref="imageElement" :src="srcData" v-bind="attrsWithoutSrc" />
</template>
