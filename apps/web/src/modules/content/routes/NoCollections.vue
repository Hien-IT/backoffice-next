<!-- Ported from directus/app/src/modules/content/routes/no-collections.vue -->
<script setup lang="ts">
// Backoffice: v-info in the blank page card of the design-system (like PrivateNotFoundRoute); the create button goes to
// the Settings frame (D-71).
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import PrivateView from '../../../layout/PrivateView.vue';
import { useUserStore } from '../../../stores/user.ts';
import ContentNavigation from '../components/ContentNavigation.vue';

const userStore = useUserStore();
</script>

<template>
	<PrivateView :title="$t('content')" icon="box">
		<template #navigation>
			<ContentNavigation />
		</template>

		<div
			class="flex flex-col items-center justify-center gap-4 text-center rounded-2xl border border-gray-200 bg-white px-5 py-7 xl:px-10 xl:py-12 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<span class="text-gray-500 dark:text-gray-400"><BoIcon name="box" size="lg" /></span>
			<h2 class="m-0 text-xl font-semibold text-gray-800 dark:text-white/90">{{ $t('no_collections') }}</h2>
			<p class="m-0 max-w-md text-gray-500 dark:text-gray-400">
				{{ userStore.isAdmin ? $t('no_collections_copy_admin') : $t('no_collections_copy') }}
			</p>
			<BoButton v-if="userStore.isAdmin" to="/settings/data-model/+">{{ $t('create_collection') }}</BoButton>
		</div>
	</PrivateView>
</template>
