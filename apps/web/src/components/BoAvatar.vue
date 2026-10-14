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
	<span class="inline-flex size-eh-12 items-center justify-center overflow-hidden rounded-eh-md">
		<img
			v-if="avatarUrl && !avatarError"
			:src="avatarUrl"
			:alt="name"
			class="size-full object-cover"
			@error="avatarError = true"
		/>
		<BoIcon v-else name="account_circle" :label="name" />
	</span>
</template>
