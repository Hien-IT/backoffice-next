<!-- Ported from directus/app/src/routes/login/login.vue -->
<script setup lang="ts">
// Backoffice: LdapForm and SsoLinks land in Phase 6 (US4); until then those drivers render nothing. The provider
// select has a visible label (FR-067).
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
import LoginForm from './LoginForm.vue';

// ssoErrorCode is read by SsoLinks (Phase 6).
const { logoutReason = null } = defineProps<{
	// eslint-disable-next-line vue/require-default-prop -- not read until Phase 6
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
		<div class="mb-eh-5 flex flex-wrap items-end justify-between gap-eh-3">
			<h1 class="truncate text-eh-3xl font-bold text-eh-text-primary">{{ $t('sign_in') }}</h1>
			<div v-if="!authenticated && providerOptions.length > 1" class="min-w-[10rem]">
				<BoSelect v-model="providerSelect" :items="providerOptions" :label="$t('fields.directus_users.provider')" />
			</div>
		</div>

		<ContinueAs v-if="authenticated" />
		<!-- Phase 6: LdapForm when driver === 'ldap' -->
		<LoginForm
			v-else-if="driver === DEFAULT_AUTH_DRIVER || driver === 'local'"
			:provider="provider ?? DEFAULT_AUTH_PROVIDER"
		/>
		<!-- Phase 6: SsoLinks (auth.providers, ssoErrorCode) when not authenticated -->

		<div
			v-if="!authenticated && serverStore.info.project?.public_registration"
			class="mt-eh-10 flex flex-wrap items-center justify-center gap-eh-2 text-center text-eh-text-secondary"
		>
			{{ $t('dont_have_an_account') }}
			<RouterLink to="/register" class="text-eh-text-primary underline">
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
