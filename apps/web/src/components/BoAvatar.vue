<script setup lang="ts">
// Avatar image as module-bar-avatar.vue of Directus: system-medium-cover thumbnail, account_circle icon when there is
// no avatar or the image fails to load.
import { computed, ref, watch } from 'vue';
import { getAssetUrl } from '../utils/get-asset-url.ts';
import BoIcon from './BoIcon.vue';

const { avatarId, cacheBuster } = defineProps<{
	avatarId?: string | null;
	name: string;
	/** avatar.modified_on, so a changed avatar is fetched again. */
	cacheBuster?: string | null;
}>();

const avatarUrl = computed(() =>
	avatarId ? getAssetUrl(avatarId, { imageKey: 'system-medium-cover', cacheBuster: cacheBuster ?? false }) : null,
);

const avatarError = ref(false);

watch(avatarUrl, () => (avatarError.value = false));
</script>

<template>
	<span
		class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
	>
		<img
			v-if="avatarUrl && !avatarError"
			:src="avatarUrl"
			:alt="name"
			class="h-full w-full rounded-full object-cover"
			@error="avatarError = true"
		/>
		<!-- 40px, about 80 % of the 48px avatar (component-specs Avatar fallback). -->
		<BoIcon v-else name="account_circle" :label="name" :style="{ fontSize: '2.5rem' }" />
	</span>
</template>
