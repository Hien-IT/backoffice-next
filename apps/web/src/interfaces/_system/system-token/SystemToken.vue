<!-- Ported from directus/app/src/interfaces/_system/system-token/system-token.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-19 "Token field". VInput is ../../input/InputField.vue (ids from FormField); the three icons
// are named ghost BoButtons with tooltips (the key icon stays a plain icon when it cannot remove); VDialog + VCard are
// BoDialog, VError is a danger BoNotice with translateAPIError. Requests go through the SDK. The new token lives only
// in this component's state: never logged, never in the URL, gone on unmount (CHK084).
import { getEndpoint } from '@directus/utils';
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import { useClipboard } from '../../../composables/use-clipboard.ts';
import { type APIError, translateAPIError } from '../../../lang/index.ts';
import InputField from '../../input/InputField.vue';

const props = withDefaults(
	defineProps<{
		value?: string | null;
		disabled?: boolean;
		primaryKey?: string | number;
		collection?: string;
	}>(),
	{
		value: null,
	},
);

const { t } = useI18n();
const { isCopySupported, copyToClipboard } = useClipboard();
const refresh = inject<(() => void) | null>('refresh', null);

const localValue = ref<string | null>(null);
const loading = ref(false);
const confirmRegenerate = ref(false);
const confirmRemove = ref(false);
const tokenSavedInline = ref(false);
const generateError = ref<unknown>(null);
const regenerateError = ref<unknown>(null);
const removeError = ref<unknown>(null);
const regexp = new RegExp('^[*]+$');

const isNewUser = computed(() => props.primaryKey === '+' || props.primaryKey === undefined);
const hasPersistedToken = computed(() => !!props.value && regexp.test(props.value));
const hasToken = computed(() => hasPersistedToken.value || !!localValue.value);
const fieldDisabled = computed(() => props.disabled || isNewUser.value);

const placeholder = computed(() => {
	if (fieldDisabled.value && !props.value) return null;
	return props.value ? t('interfaces.system-token.value_securely_saved') : t('interfaces.system-token.placeholder');
});

watch(
	() => props.value,
	(newValue) => {
		if (newValue && !regexp.test(newValue)) return;
		// Collab's receiveSave calls getItem(), updating props.value to the masked value and clearing the display.
		if (localValue.value && newValue) return;
		localValue.value = null;
		tokenSavedInline.value = false;
		generateError.value = null;
		regenerateError.value = null;
		removeError.value = null;
	},
	{ immediate: true },
);

async function persistToken(token: string | null) {
	await sdk.request(
		requestEndpoint(`${getEndpoint(props.collection!)}/${props.primaryKey}`, { method: 'PATCH', body: { token } }),
	);
}

function onGenerateOrRegenerate() {
	if (hasToken.value) {
		openRegenerateConfirm();
		return;
	}

	generateAndPersistToken('generate');
}

function onRemove() {
	if (hasToken.value) {
		openRemoveConfirm();
	}
}

function openRegenerateConfirm() {
	regenerateError.value = null;
	confirmRegenerate.value = true;
}

function closeRegenerateConfirm() {
	if (loading.value) return;
	confirmRegenerate.value = false;
	regenerateError.value = null;
}

async function confirmRegenerateToken() {
	await generateAndPersistToken('regenerate');
}

async function generateAndPersistToken(action: 'generate' | 'regenerate') {
	if (!props.primaryKey || !props.collection) return;

	loading.value = true;

	if (action === 'regenerate') regenerateError.value = null;
	else generateError.value = null;

	try {
		const token = await sdk.request(requestEndpoint<string>('/utils/random/string'));
		await persistToken(token);
		localValue.value = token;
		tokenSavedInline.value = true;

		if (action === 'regenerate') {
			confirmRegenerate.value = false;
		}
	} catch (error) {
		if (action === 'regenerate') {
			regenerateError.value = error;
		} else {
			generateError.value = error;
		}
	} finally {
		loading.value = false;
	}
}

function openRemoveConfirm() {
	removeError.value = null;
	confirmRemove.value = true;
}

function closeRemoveConfirm() {
	if (loading.value) return;
	confirmRemove.value = false;
	removeError.value = null;
}

async function confirmRemoveToken() {
	if (!props.primaryKey || !props.collection) return;

	loading.value = true;
	removeError.value = null;

	try {
		await persistToken(null);
		confirmRemove.value = false;
		localValue.value = null;
		tokenSavedInline.value = false;
		refresh?.();
	} catch (error) {
		removeError.value = error;
	} finally {
		loading.value = false;
	}
}

function select(event: FocusEvent) {
	if (localValue.value) (event.target as HTMLInputElement | null)?.select();
}

function deselect() {
	window.getSelection()?.removeAllRanges();
}

const errorText = (error: unknown) => translateAPIError(error as APIError);

const generateLabel = computed(() =>
	hasToken.value ? t('interfaces.system-token.regenerate') : t('interfaces.system-token.generate'),
);
</script>

<template>
	<div class="flex flex-col gap-3">
		<InputField
			:model-value="localValue ?? undefined"
			:type="localValue ? 'text' : 'password'"
			:placeholder="placeholder ?? undefined"
			:disabled="fieldDisabled"
			readonly
			class="font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]"
			:class="{
				'[&_input]:placeholder:text-brand-500 dark:[&_input]:placeholder:text-brand-400': value && !localValue,
			}"
			:data-saved="(value && !localValue) || undefined"
			@focus="select"
			@blur="deselect"
		>
			<template #append>
				<BoTooltip v-if="localValue && isCopySupported" :text="$t('copy')">
					<BoButton
						variant="ghost"
						icon="content_copy"
						:aria-label="$t('copy')"
						data-action="copy"
						@click="copyToClipboard(localValue)"
					/>
				</BoTooltip>
				<BoTooltip v-if="!disabled && !isNewUser" :text="generateLabel">
					<BoButton
						variant="ghost"
						:icon="hasToken ? 'refresh' : 'add'"
						:aria-label="generateLabel"
						:disabled="loading"
						data-action="generate"
						@click="onGenerateOrRegenerate"
					/>
				</BoTooltip>
				<template v-if="!isNewUser">
					<BoTooltip v-if="!disabled && hasToken" :text="$t('interfaces.system-token.remove_token')">
						<BoButton
							variant="ghost"
							icon="clear"
							:aria-label="$t('interfaces.system-token.remove_token')"
							:disabled="loading"
							class="hover:text-error-600 dark:hover:text-error-400"
							data-action="remove"
							@click="onRemove"
						/>
					</BoTooltip>
					<span v-else class="flex size-10 items-center justify-center" data-action="key">
						<BoIcon name="vpn_key" :class="{ 'text-brand-500 dark:text-brand-400': disabled && hasToken }" />
					</span>
				</template>
			</template>
		</InputField>

		<BoNotice v-if="isNewUser">
			{{ $t('interfaces.system-token.new_user_disabled_notice') }}
		</BoNotice>

		<BoNotice v-else-if="tokenSavedInline && localValue" aria-live="polite">
			<p>{{ $t('interfaces.system-token.token_saved_notice') }}</p>
			<p>{{ $t('interfaces.system-token.token_saved_copy') }}</p>
		</BoNotice>

		<BoNotice v-else-if="generateError" type="danger">{{ errorText(generateError) }}</BoNotice>

		<BoDialog
			:open="confirmRegenerate"
			:title="$t('interfaces.system-token.regenerate_confirm_title')"
			@update:open="!$event && closeRegenerateConfirm()"
		>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{{ $t('interfaces.system-token.regenerate_confirm_body') }}
			</p>
			<BoNotice v-if="regenerateError" type="danger" class="mt-4">{{ errorText(regenerateError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" :disabled="loading" @click="closeRegenerateConfirm">
					{{ $t('cancel') }}
				</BoButton>
				<BoButton variant="danger" :loading="loading" @click="confirmRegenerateToken">
					{{ $t('interfaces.system-token.regenerate') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="confirmRemove"
			:title="$t('interfaces.system-token.remove_confirm_title')"
			@update:open="!$event && closeRemoveConfirm()"
		>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				{{ $t('interfaces.system-token.remove_confirm_body') }}
			</p>
			<BoNotice v-if="removeError" type="danger" class="mt-4">{{ errorText(removeError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" :disabled="loading" @click="closeRemoveConfirm">
					{{ $t('cancel') }}
				</BoButton>
				<BoButton variant="danger" :loading="loading" @click="confirmRemoveToken">
					{{ $t('interfaces.system-token.remove_token') }}
				</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
