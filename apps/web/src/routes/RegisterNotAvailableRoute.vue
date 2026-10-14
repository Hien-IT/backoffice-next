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
		<h1 class="mb-eh-5 text-eh-3xl font-bold text-eh-text-primary">{{ $t('register_not_available_title') }}</h1>

		<p class="mb-eh-5 text-eh-text-primary">{{ $t('register_not_available') }}</p>

		<div class="flex flex-wrap items-center justify-center gap-eh-2 text-center text-eh-text-secondary">
			{{ $t('already_have_an_account') }}
			<RouterLink to="/login" class="text-eh-text-primary underline">{{ $t('sign_in') }}</RouterLink>
		</div>

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
