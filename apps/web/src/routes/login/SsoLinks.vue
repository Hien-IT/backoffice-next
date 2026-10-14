<!-- Ported from directus/app/src/routes/login/components/sso-links.vue -->
<script setup lang="ts">
// Backoffice: links start from apiUrl of config.json (the API may be on another origin) instead of getRootPath() on
// the page origin; they are real <a href> (keyboard, FR-067) that save the provider on click; the localStorage key is
// backoffice-sso-provider; last_sso_provider is not kept (it only picked a link the OTP field never uses: the field
// shows for the saved provider only); ?error&code=<CODE> shows like ?reason=<CODE> (FR-042); the OTP field has a
// visible label and errors show in a danger BoNotice (role=alert).
import formatTitle from '@directus/format-title';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getApiUrl } from '../../api/sdk.ts';
import BoIcon from '../../components/BoIcon.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import { AUTH_SSO_DRIVERS } from '../../constants.ts';
import { translateAPIError } from '../../lang/index.ts';
import type { AuthProvider } from '../../types/login.ts';

const { providers, ssoErrorCode = null } = defineProps<{
	providers: AuthProvider[];
	ssoErrorCode?: string | null;
}>();

const route = useRoute();

const otp = ref<string | null>(null);
const submitting = ref(false);

const isOTPValid = computed(() => typeof otp.value === 'string' && otp.value.length === 6);

const reason = computed(() => {
	const value = route.query['reason'];
	return (Array.isArray(value) ? value[0] : value) ?? null;
});

const requiresTFA = computed(() => reason.value === 'INVALID_OTP');

const otpAttempted = ref(false);

// Track the original provider that was clicked for OTP submission
const originalProviderName = ref<string | null>(null);

onMounted(() => {
	// Check if a previous OTP attempt was made (to conditionally show the inline error)
	const attempted = sessionStorage.getItem('sso_otp_attempted');

	if (attempted === '1') {
		otpAttempted.value = true;
		sessionStorage.removeItem('sso_otp_attempted');
	}

	// Get the provider from localStorage that was set when the user clicked the SSO link
	if (requiresTFA.value) {
		const storedProvider = localStorage.getItem('backoffice-sso-provider');

		if (storedProvider) {
			originalProviderName.value = storedProvider;
		}
	}
});

const otpInlineError = computed(() =>
	requiresTFA.value && otpAttempted.value ? translateAPIError('INVALID_OTP') : null,
);

const ssoProviders = computed(() =>
	providers
		.filter((provider) => AUTH_SSO_DRIVERS.includes(provider.driver))
		.map((provider) => {
			const ssoLoginLink = new URL(`auth/login/${provider.name}`, getApiUrl());

			const redirectToLink = new URL(window.location.href);
			redirectToLink.searchParams.set('continue', '');

			ssoLoginLink.searchParams.set('redirect', redirectToLink.toString());

			if (otp.value) {
				ssoLoginLink.searchParams.set('otp', otp.value);
			}

			return {
				name: provider.name,
				label: provider.label || formatTitle(provider.name),
				link: ssoLoginLink.toString(),
				icon: provider.icon ?? 'account_circle',
			};
		}),
);

const selectedProviderLink = computed(
	() => ssoProviders.value.find((p) => p.name === originalProviderName.value)?.link ?? null,
);

const errorFormatted = computed(() => {
	const validReasons = ['SIGN_OUT', 'SESSION_EXPIRED'];

	// When requiring TFA, don't show the error banner; render the OTP input instead
	if (requiresTFA.value) return null;

	if (ssoErrorCode) return translateAPIError(ssoErrorCode);

	if (reason.value && !validReasons.includes(reason.value)) {
		return translateAPIError(reason.value);
	}

	return null;
});

function handleSSOClick(provider: { name: string }) {
	localStorage.setItem('backoffice-sso-provider', provider.name);
}

function onSubmitOTP() {
	if (submitting.value) return;
	if (!isOTPValid.value) return;
	const link = selectedProviderLink.value ?? ssoProviders.value[0]?.link ?? null;
	if (!link) return;
	submitting.value = true;
	sessionStorage.setItem('sso_otp_attempted', '1');
	window.location.href = link;
}

watch(otp, (val) => {
	if (typeof val === 'string' && val.length === 6) {
		onSubmitOTP();
	}
});
</script>

<template>
	<div v-if="ssoProviders.length > 0" class="mt-eh-6 flex flex-col gap-eh-3 border-t border-eh-border pt-eh-6">
		<BoNotice v-if="errorFormatted" type="danger">
			{{ errorFormatted }}
		</BoNotice>

		<template v-for="provider in ssoProviders" :key="provider.name">
			<a
				:href="provider.link"
				class="flex h-eh-10 w-full items-center overflow-hidden rounded-eh-md border-2 border-eh-surface-subtle bg-eh-surface-subtle text-eh-sm text-eh-text-primary no-underline transition-colors hover:border-eh-border"
				@click="handleSSOClick(provider)"
			>
				<span class="flex w-eh-10 shrink-0 items-center justify-center self-stretch bg-eh-border">
					<BoIcon :name="provider.icon" />
				</span>
				<span class="min-w-0 truncate px-eh-4">
					{{ $t('log_in_with', { provider: provider.label }) }}
				</span>
			</a>

			<template v-if="requiresTFA && originalProviderName === provider.name">
				<BoInput
					v-model="otp"
					autofocus
					type="text"
					name="otp"
					autocomplete="one-time-code"
					inputmode="numeric"
					:maxlength="6"
					:readonly="submitting"
					:label="$t('otp')"
					@keydown.enter.prevent="onSubmitOTP"
				/>
				<BoNotice v-if="otpInlineError" type="danger">{{ otpInlineError }}</BoNotice>
			</template>
		</template>
	</div>
</template>
