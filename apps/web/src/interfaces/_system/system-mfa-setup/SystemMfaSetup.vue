<!-- Ported from directus/app/src/interfaces/_system/system-mfa-setup/system-mfa-setup.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-19 "TFA field". The block VCheckbox is a BoCheckbox in a bordered h-11 box with the `launch`
// icon; VDialog + VCard are BoDialog (title from the step shown; submit buttons in the actions row reach their form
// through the `form` attribute); VError is a danger BoNotice with translateAPIError. The QR code is the data URL of
// use-tfa-setup in an <img> instead of a canvas (as TfaSetupRoute). Another user's TFA state comes from `tfa_secret`
// only (CHK022). The secret is shown in the dialog only, never logged (CHK084).
import { computed, inject, nextTick, ref, type Ref, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../components/BoButton.vue';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoProgressCircular from '../../../components/BoProgressCircular.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useTFASetup } from '../../../composables/use-tfa-setup.ts';
import { DEFAULT_AUTH_DRIVER } from '../../../constants.ts';
import { translateAPIError } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';

type User = { id: string; provider?: string | null; tfa_secret?: string | null };

const props = defineProps<{
	value: string | null;
	primaryKey?: string;
	disabled?: boolean;
}>();

const { t } = useI18n();
const userStore = useUserStore();
const enableActive = ref(false);
const disableActive = ref(false);
const cancelSetupActive = ref(false);

const inputOTP = useTemplateRef<InstanceType<typeof BoInput>>('inputOTP');
const a11y = inject(FORM_FIELD_A11Y, null);
const formId = useId();

const currentUser = computed(() => {
	const user = userStore.currentUser;
	return user && !('share' in user) ? (user as User) : null;
});

const isCurrentUser = computed(() => currentUser.value?.id === props.primaryKey);

// Get the user data from the parent context
const values = inject<Ref<Record<string, any>>>('values', ref<Record<string, any>>({}));

const profileUser = computed(() => {
	// If we have values and they contain user data, use that
	if (values.value && Object.keys(values.value).length > 0) {
		return values.value as User;
	}

	return null;
});

// Detect if the user being viewed is an SSO user
const isSSOUser = computed(() => {
	// Use profile user data when viewing a different user, otherwise use current user
	const user = profileUser.value && !isCurrentUser.value ? profileUser.value : userStore.currentUser;
	return !!user && !('share' in user) && user.provider !== DEFAULT_AUTH_DRIVER;
});

const effectiveTFAEnabled = computed(() => {
	if (profileUser.value && !isCurrentUser.value) {
		// Backoffice: OAuth and password users alike; DR also reads the require_tfa_setup key here, but that key
		// belongs to the browser of the signed-in user, not to the user being viewed (FR-082, CHK022).
		return !!profileUser.value.tfa_secret;
	}

	if (isCurrentUser.value) {
		const user = currentUser.value;
		if (!user) return !!props.value;

		// OAuth users
		if (user.provider !== DEFAULT_AUTH_DRIVER) {
			return !!(user.tfa_secret || requireTfaSetup.value === user.id);
		}

		// Password users
		return !!user.tfa_secret;
	}

	// if no profile user data and not viewing current user, use props.value
	return !!props.value;
});

const {
	generateTFA,
	enableTFA,
	disableTFA,
	adminDisableTFA,
	requestTFASetup,
	cancelTFASetup,
	loading,
	password,
	tfaEnabled,
	tfaGenerated,
	secret,
	otp,
	error,
	qrCode,
	requireTfaSetup,
} = useTFASetup(!!props.value);

// Inject the discard functionality from the parent form
const discardAllChanges = inject<(() => void) | null>('discardAllChanges', null);

// Add a method to trigger discard all changes
function triggerDiscardAllChanges() {
	if (discardAllChanges) {
		discardAllChanges();
	}
}

watch(
	() => effectiveTFAEnabled.value,
	() => {
		tfaEnabled.value = effectiveTFAEnabled.value;
	},
	{ immediate: true },
);

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

async function enable() {
	const success = await enableTFA();
	enableActive.value = !success;

	if (!success) {
		await nextTick();
		focusOTP();
	}
}

async function enableSSO() {
	triggerDiscardAllChanges();
	const success = await requestTFASetup();
	enableActive.value = !success;
}

async function disable() {
	const success = await (isCurrentUser.value ? disableTFA() : adminDisableTFA(props.primaryKey!));
	disableActive.value = !success;
}

async function cancelSetup() {
	const success = await cancelTFASetup();
	cancelSetupActive.value = !success;
}

async function generateForPasswordUser() {
	// For password users, we always require password
	await generateTFA(true);
}

function toggle() {
	if (tfaEnabled.value === false) {
		enableActive.value = true;
	} else {
		// For SSO users, check if they have a pending TFA setup request in localStorage
		// Use profile user data when viewing a different user, otherwise use current user
		const userToCheck = profileUser.value && !isCurrentUser.value ? profileUser.value : currentUser.value;

		if (isSSOUser.value && requireTfaSetup.value === userToCheck?.id && !userToCheck?.tfa_secret) {
			cancelSetupActive.value = true;
		} else {
			disableActive.value = true;
		}
	}
}

function cancelAndClose() {
	tfaGenerated.value = false;
	enableActive.value = false;
	disableActive.value = false;
	cancelSetupActive.value = false;
	password.value = '';
	otp.value = '';
	secret.value = '';
	error.value = null;
}

const showSSOStep = computed(
	() => isSSOUser.value && tfaEnabled.value === false && tfaGenerated.value === false && loading.value === false,
);

const showPasswordStep = computed(
	() => !isSSOUser.value && tfaEnabled.value === false && tfaGenerated.value === false && loading.value === false,
);

const showQRStep = computed(() => tfaEnabled.value === false && tfaGenerated.value === true && loading.value === false);

const enableTitle = computed(() => {
	if (showPasswordStep.value) return t('enter_password_to_enable_tfa');
	if (showQRStep.value) return t('tfa_scan_code');
	return t('enable_tfa');
});

const checkboxDisabled = computed(() => props.disabled || (!isCurrentUser.value && !tfaEnabled.value));
</script>

<template>
	<div>
		<div
			class="flex h-11 items-center gap-3 rounded-lg border px-4 shadow-theme-xs"
			:class="
				checkboxDisabled
					? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]'
					: 'border-gray-300 dark:border-gray-700 dark:bg-gray-900'
			"
		>
			<BoCheckbox
				:id="a11y?.inputId"
				:model-value="tfaEnabled"
				:disabled="checkboxDisabled"
				:aria-describedby="a11y?.describedBy"
				@update:model-value="toggle"
			>
				{{ tfaEnabled ? $t('enabled') : $t('disabled') }}
			</BoCheckbox>
			<BoIcon
				name="launch"
				class="ms-auto"
				:class="tfaEnabled ? 'text-brand-500 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'"
			/>
		</div>

		<BoDialog :open="enableActive" :title="enableTitle" @update:open="!$event && cancelAndClose()">
			<!-- SSO user flow -->
			<div v-if="showSSOStep">
				<p class="text-sm text-gray-700 dark:text-gray-400">{{ $t('sso_tfa_setup_notice') }}</p>
				<BoNotice v-if="error" type="danger" class="mt-4">{{ translateAPIError(error) }}</BoNotice>
			</div>

			<!-- Password user flow -->
			<form v-else-if="showPasswordStep" :id="`${formId}-password`" @submit.prevent="generateForPasswordUser">
				<BoInput
					v-model="password"
					type="password"
					autocomplete="current-password"
					:label="$t('password')"
					:placeholder="$t('password')"
					autofocus
				/>
				<BoNotice v-if="error" type="danger" class="mt-4">{{ translateAPIError(error) }}</BoNotice>
			</form>

			<div v-else-if="loading === true" class="flex justify-center py-16">
				<BoProgressCircular
					indeterminate
					:aria-label="$t('loading')"
					class="text-2xl text-brand-500 dark:text-brand-400"
				/>
			</div>

			<form v-else-if="showQRStep" :id="`${formId}-otp`" class="flex flex-col gap-4" @submit.prevent="enable">
				<img v-if="qrCode" :src="qrCode" :alt="$t('tfa_scan_code')" class="mx-auto block size-40" />
				<output
					class="block text-center font-mono tracking-widest break-all text-gray-500 select-all dark:text-gray-400"
					data-testid="tfa-secret"
					v-text="secret"
				/>
				<BoInput
					ref="inputOTP"
					v-model="otp"
					type="text"
					autocomplete="one-time-code"
					inputmode="numeric"
					:maxlength="6"
					:label="$t('otp')"
					:placeholder="$t('otp')"
				/>
				<BoNotice v-if="error" type="danger">{{ translateAPIError(error) }}</BoNotice>
			</form>

			<template #actions>
				<BoButton variant="secondary" @click="cancelAndClose">{{ $t('cancel') }}</BoButton>
				<BoButton v-if="showSSOStep" :loading="loading" @click="enableSSO">{{ $t('enable_tfa') }}</BoButton>
				<BoButton v-else-if="showPasswordStep" type="submit" :form="`${formId}-password`" :loading="loading">
					{{ $t('next') }}
				</BoButton>
				<BoButton v-else-if="showQRStep" type="submit" :form="`${formId}-otp`" :disabled="otp.length !== 6">
					{{ $t('done') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="disableActive"
			:title="isCurrentUser ? $t('enter_otp_to_disable_tfa') : $t('disable_tfa')"
			@update:open="!$event && cancelAndClose()"
		>
			<form :id="`${formId}-disable`" @submit.prevent="disable">
				<BoInput
					v-if="isCurrentUser"
					v-model="otp"
					type="text"
					autocomplete="one-time-code"
					inputmode="numeric"
					:maxlength="6"
					:label="$t('otp')"
					:placeholder="$t('otp')"
					autofocus
				/>
				<p v-else class="text-sm text-gray-700 dark:text-gray-400">{{ $t('admin_disable_tfa_text') }}</p>
				<BoNotice v-if="error" type="danger" class="mt-4">{{ translateAPIError(error) }}</BoNotice>
			</form>

			<template #actions>
				<BoButton variant="secondary" @click="cancelAndClose">{{ $t('cancel') }}</BoButton>
				<BoButton
					type="submit"
					variant="danger"
					:form="`${formId}-disable`"
					:loading="loading"
					:disabled="isCurrentUser && otp.length !== 6"
				>
					{{ $t('disable_tfa') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog :open="cancelSetupActive" :title="$t('cancel_tfa_setup')" @update:open="!$event && cancelAndClose()">
			<p class="text-sm text-gray-700 dark:text-gray-400">{{ $t('cancel_tfa_setup_notice') }}</p>
			<BoNotice v-if="error" type="danger" class="mt-4">{{ translateAPIError(error) }}</BoNotice>

			<template #actions>
				<BoButton variant="secondary" @click="cancelAndClose">{{ $t('keep_setup') }}</BoButton>
				<BoButton :loading="loading" @click="cancelSetup">{{ $t('cancel_setup') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
