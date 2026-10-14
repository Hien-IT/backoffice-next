<script setup lang="ts">
// The /register page until the registration form lands with the Users module (D-44): no form, a link to sign in.
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../components/BoIcon.vue';
import PublicView from '../layout/PublicView.vue';

const { t } = useI18n();

useHead({
	title: t('register'),
});
</script>

<template>
	<PublicView>
		<h1 class="mb-5 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90 sm:mb-8">
			{{ $t('register_not_available_title') }}
		</h1>

		<p class="mb-5 text-gray-700 dark:text-gray-400">{{ $t('register_not_available') }}</p>

		<div
			class="flex flex-wrap items-center justify-center gap-1 text-center text-gray-700 sm:justify-start sm:text-start dark:text-gray-400"
		>
			{{ $t('already_have_an_account') }}
			<RouterLink
				to="/login"
				class="rounded-sm text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			>
				{{ $t('sign_in') }}
			</RouterLink>
		</div>

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
