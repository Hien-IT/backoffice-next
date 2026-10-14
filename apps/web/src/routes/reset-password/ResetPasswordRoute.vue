<!-- Ported from directus/app/src/routes/reset-password/reset-password.vue -->
<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';
import PublicView from '../../layout/PublicView.vue';
import RequestForm from './RequestForm.vue';
import ResetForm from './ResetForm.vue';

const { t } = useI18n();

const route = useRoute();

const resetToken = computed(() => {
	const token = route.query['token'];
	return Array.isArray(token) ? token[0] : token;
});

useHead({
	title: t('reset_password'),
});
</script>

<template>
	<PublicView>
		<h1 class="mb-eh-5 text-eh-3xl font-bold text-eh-text-primary">{{ $t('reset_password') }}</h1>

		<RequestForm v-if="!resetToken" />
		<ResetForm v-else :token="resetToken" />

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
