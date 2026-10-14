<!-- Ported from directus/app/src/routes/tfa-setup.vue -->
<script setup lang="ts">
// Backoffice: the QR code is an <img> with the secret as text (data-testid="tfa-secret" for E2E); errors go through
// translateAPIError in a danger notice; the router comes from useRouter.
import { useHead } from '@unhead/vue';
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import BoInput from '../components/BoInput.vue';
import BoNotice from '../components/BoNotice.vue';
import BoProgressCircular from '../components/BoProgressCircular.vue';
import { useSafeRedirect } from '../composables/use-safe-redirect.ts';
import { useTFASetup } from '../composables/use-tfa-setup.ts';
import { DEFAULT_AUTH_DRIVER } from '../constants.ts';
import { translateAPIError } from '../lang/index.ts';
import PublicView from '../layout/PublicView.vue';
import { useAppStore } from '../stores/app.ts';
import { useUserStore } from '../stores/user.ts';

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();
const userStore = useUserStore();

const { redirect, resolveRedirect } = useSafeRedirect();

const inputOTP = useTemplateRef<InstanceType<typeof BoInput>>('inputOTP');

onMounted(() => {
	if (appStore.authenticated === false) {
		router.push('/login');
	}

	// Validate redirect in the background
	if (router.currentRoute.value.query['redirect']) {
		resolveRedirect(
			router.currentRoute.value.query['redirect'] as string,
			router.currentRoute.value.query['provider'] as string | undefined,
		);
	}
});

const {
	generateTFA,
	enableTFA,
	cancelTFASetup,
	loading,
	password,
	tfaEnabled,
	tfaGenerated,
	secret,
	otp,
	error,
	qrCode,
} = useTFASetup(false);

function focusOTP() {
	(inputOTP.value?.$el as HTMLElement | undefined)?.querySelector('input')?.focus();
}

watch(
	() => tfaGenerated.value,
	async (generated) => {
		if (generated) {
			await nextTick();
			focusOTP();
		}
	},
);

// Check if the current user is an OAuth user
const isOAuthUser = computed(() => {
	const user = userStore.currentUser;
	return !!user && !('share' in user) && user['provider'] !== DEFAULT_AUTH_DRIVER;
});

// Check if the user has role that requires TFA
const roleRequiresTFA = computed(() => {
	const user = userStore.currentUser;
	if (!user || 'share' in user) return false;
	return !!user.enforce_tfa;
});

// Check if user can skip password (OAuth users can always skip password)
const canSkipPassword = computed(() => {
	return isOAuthUser.value;
});

// Check if cancel button should be shown (not shown if role requires TFA)
const showCancelButton = computed(() => {
	return !roleRequiresTFA.value;
});

async function generate() {
	await generateTFA(!canSkipPassword.value);
}

async function enable() {
	const success = await enableTFA();

	if (success) {
		navigateAfterTFA();
	} else {
		await nextTick();
		focusOTP();
	}
}

async function cancel() {
	// If user has tfa_setup_status pending, call the API to cancel setup before redirecting
	try {
		await cancelTFASetup();
	} catch (error) {
		// If cancel fails, still redirect to avoid getting stuck
		// eslint-disable-next-line no-console
		console.error('Failed to cancel 2FA setup:', error);
	}

	navigateAfterTFA();
}

function navigateAfterTFA() {
	const user = userStore.currentUser;
	const fallback = (user && !('share' in user) && user.last_page) || '/login';

	// If the redirect was validated as an absolute URL (public URL will be relative), navigate via window.location
	if (redirect.value && /^(https?:)?\/\//.test(redirect.value)) {
		window.location.href = redirect.value;
	} else {
		router.push(redirect.value ?? fallback);
	}
}

useHead({
	title: t('tfa_setup'),
});
</script>

<template>
	<PublicView>
		<h1 class="mb-eh-5 text-eh-3xl font-bold text-eh-text-primary">{{ $t('tfa_setup') }}</h1>

		<form
			v-if="tfaEnabled === false && tfaGenerated === false && loading === false"
			class="flex flex-col gap-eh-4"
			@submit.prevent="generate"
		>
			<p class="font-semibold">
				{{ canSkipPassword ? $t('tfa_setup_description') : $t('enter_password_to_enable_tfa') }}
			</p>
			<BoInput
				v-if="!canSkipPassword"
				v-model="password"
				type="password"
				name="password"
				autocomplete="current-password"
				:label="$t('password')"
				autofocus
			/>
			<BoNotice v-if="error" type="danger">{{ translateAPIError(error) }}</BoNotice>
			<div class="flex items-center justify-between gap-eh-4">
				<button
					v-if="showCancelButton"
					type="button"
					class="text-eh-text-secondary transition-colors hover:text-eh-text-primary"
					@click="cancel"
				>
					{{ $t('cancel') }}
				</button>
				<BoButton type="submit" :loading="loading" class="ms-auto">{{ $t('next') }}</BoButton>
			</div>
		</form>

		<BoProgressCircular
			v-else-if="loading === true"
			indeterminate
			:aria-label="$t('loading')"
			class="text-eh-2xl text-eh-action-primary"
		/>

		<div v-show="tfaEnabled === false && tfaGenerated === true && loading === false">
			<form class="flex flex-col gap-eh-4" @submit.prevent="enable">
				<p class="font-semibold">{{ $t('tfa_scan_code') }}</p>
				<img v-if="qrCode" :src="qrCode" :alt="$t('tfa_scan_code')" class="mx-auto block size-[10rem]" />
				<output
					class="block text-center font-mono tracking-widest break-all text-eh-text-secondary"
					data-testid="tfa-secret"
					v-text="secret"
				/>
				<BoInput
					ref="inputOTP"
					v-model="otp"
					type="text"
					name="otp"
					autocomplete="one-time-code"
					inputmode="numeric"
					:maxlength="6"
					:label="$t('otp')"
				/>
				<BoNotice v-if="error" type="danger">{{ translateAPIError(error) }}</BoNotice>
				<div class="flex items-center justify-between gap-eh-4">
					<button
						v-if="showCancelButton"
						type="button"
						class="text-eh-text-secondary transition-colors hover:text-eh-text-primary"
						@click="cancel"
					>
						{{ $t('cancel') }}
					</button>
					<BoButton type="submit" :disabled="otp.length !== 6" class="ms-auto">{{ $t('done') }}</BoButton>
				</div>
			</form>
		</div>

		<template #notice>
			<BoIcon name="lock" size="sm" />
			{{ $t('not_authenticated') }}
		</template>
	</PublicView>
</template>
