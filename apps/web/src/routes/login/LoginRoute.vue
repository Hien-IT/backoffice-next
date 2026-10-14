<!-- Ported from directus/app/src/routes/login/login.vue -->
<script setup lang="ts">
// Backoffice: the provider select has a visible label (FR-067); ssoErrorCode (?error&code) goes to SsoLinks (FR-042).
import { useHead } from '@unhead/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, unref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';
import BoSelect from '../../components/BoSelect.vue';
import { DEFAULT_AUTH_DRIVER, DEFAULT_AUTH_PROVIDER } from '../../constants.ts';
import PublicView from '../../layout/PublicView.vue';
import { useAppStore } from '../../stores/app.ts';
import { useServerStore } from '../../stores/server.ts';
import ContinueAs from './ContinueAs.vue';
import LdapForm from './LdapForm.vue';
import LoginForm from './LoginForm.vue';
import SsoLinks from './SsoLinks.vue';

const { ssoErrorCode = null, logoutReason = null } = defineProps<{
	ssoErrorCode?: string | null;
	logoutReason?: string | null;
}>();

const { t, te } = useI18n();

const appStore = useAppStore();
const serverStore = useServerStore();

const { auth, providerOptions } = storeToRefs(serverStore);

const driver = ref(unref(auth).disableDefault ? unref(providerOptions)?.[0]?.driver : DEFAULT_AUTH_DRIVER);
const provider = ref(unref(auth).disableDefault ? unref(providerOptions)?.[0]?.value : DEFAULT_AUTH_PROVIDER);

const providerSelect = computed({
	get() {
		return provider.value ?? null;
	},
	set(value: string | null) {
		provider.value = value ?? undefined;
		driver.value = unref(auth).providers.find((provider) => provider.name === value)?.driver ?? DEFAULT_AUTH_DRIVER;
	},
});

const authenticated = computed(() => appStore.authenticated);

useHead({
	title: t('sign_in'),
});
</script>

<template>
	<PublicView>
		<div class="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
			<h1 class="truncate text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
				{{ $t('sign_in') }}
			</h1>
			<div v-if="!authenticated && providerOptions.length > 1" class="min-w-40">
				<BoSelect v-model="providerSelect" :items="providerOptions" :label="$t('fields.directus_users.provider')" />
			</div>
		</div>

		<ContinueAs v-if="authenticated" />
		<LdapForm v-else-if="driver === 'ldap'" :provider="provider ?? DEFAULT_AUTH_PROVIDER" />
		<LoginForm
			v-else-if="driver === DEFAULT_AUTH_DRIVER || driver === 'local'"
			:provider="provider ?? DEFAULT_AUTH_PROVIDER"
		/>
		<SsoLinks v-if="!authenticated" :providers="auth.providers" :sso-error-code="ssoErrorCode" />

		<div
			v-if="!authenticated && serverStore.info.project?.public_registration"
			class="mt-5 flex flex-wrap items-center justify-center gap-1 text-center text-gray-700 sm:justify-start sm:text-start dark:text-gray-400"
		>
			{{ $t('dont_have_an_account') }}
			<RouterLink
				to="/register"
				class="rounded-sm text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			>
				{{ $t('sign_up_now') }}
			</RouterLink>
		</div>

		<template #notice>
			<template v-if="authenticated">
				<BoIcon name="lock_open" size="sm" />
				{{ $t('authenticated') }}
			</template>
			<template v-else-if="logoutReason && te(`logoutReason.${logoutReason}`)">
				{{ $t(`logoutReason.${logoutReason}`) }}
			</template>
			<template v-else>
				<BoIcon name="lock" size="sm" />
				{{ $t('not_authenticated') }}
			</template>
		</template>
	</PublicView>
</template>
