<!-- Ported from directus/app/src/displays/image/image.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';

type Image = {
	id: string;
	type: string;
	title: string;
	modified_on: Date;
};

const props = defineProps<{
	value: Image | null;
	circle?: boolean;
}>();

const imageError = ref(false);

const src = computed(() => {
	if (props.value?.id === null || props.value?.id === undefined) return null;

	return getAssetUrl(props.value.id, {
		imageKey: 'system-small-cover',
		cacheBuster: props.value.modified_on,
	});
});
</script>

<template>
	<BoIcon v-if="imageError" name="image" class="text-gray-500 dark:text-gray-400" />
	<img
		v-else-if="src"
		:src="src"
		loading="lazy"
		role="presentation"
		:alt="value?.title"
		class="inline-block h-full w-auto align-[-30%]"
		:class="circle ? 'circle aspect-square rounded-full' : 'rounded-lg'"
		@error="imageError = true"
	/>
	<ValueNull v-else />
</template>
