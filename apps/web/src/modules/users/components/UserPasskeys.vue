<!-- Backoffice (spec 029, D-207.4, contracts/web.md, design-system component-specs Q-47): the Passkeys card of the user
page, after the form (layout-patterns §8: the form card holds the BoForm only). Own page: list, add (password, browser
dialog, name), rename, delete. Another user's page (admin): list and delete. Hidden for non-local users, when the API is
DR or when this page is on another host than the RP ID. -->
<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoMenu from '../../../components/BoMenu.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoTable, { type BoTableColumn } from '../../../components/BoTable.vue';
import { usePasskeySupport } from '../../../composables/use-passkey-support.ts';
import { type Passkey, usePasskeys } from '../../../composables/use-passkeys.ts';
import { translateAPIError } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';
import { formatDate } from '../../../utils/format-date.ts';

const props = defineProps<{
	userId: string;
	provider: string | null;
	isCurrentUser: boolean;
}>();

const { t } = useI18n();
const userStore = useUserStore();
const { passkeyAvailable } = usePasskeySupport();
const id = useId();

const visible = computed(
	() => passkeyAvailable.value && props.provider === 'default' && (props.isCurrentUser || userStore.isAdmin),
);

const { passkeys, loading, atLimit, load, begin, save, rename, remove } = usePasskeys(
	() => props.userId,
	() => props.isCurrentUser,
);

watch(
	() => [visible.value, props.userId] as const,
	([show]) => {
		if (show) load();
	},
	{ immediate: true },
);

const columns = computed<BoTableColumn[]>(() => [
	{ key: 'name', label: t('passkey_name'), width: 220 },
	{ key: 'date_created', label: t('passkey_created'), width: 160 },
	{ key: 'last_used', label: t('passkey_last_used'), width: 160 },
]);

const relative = (value: string | null) =>
	value ? formatDate(value, { type: 'timestamp', relative: true, suffix: true }) : null;
const exact = (value: string | null) => (value ? new Date(value).toLocaleString() : undefined);

/** A message key of this card, or an API error (translateAPIError). */
type DialogError = { key: string } | { api: unknown } | null;

const errorText = (error: DialogError) => {
	if (!error) return null;
	return 'key' in error ? t(error.key) : translateAPIError(error.api as never);
};

// Add: password step, then the browser dialog, then the name step.
const adding = ref(false);
const addStep = ref<'password' | 'name'>('password');
const password = ref<string | null>(null);
const newName = ref<string | null>(null);
const pending = ref<Awaited<ReturnType<typeof begin>>>(null);
const busy = ref(false);
const addError = ref<DialogError>(null);

function defaultName(): string {
	const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
	return t('passkey_default_name', { platform: nav.userAgentData?.platform || nav.platform || 'this device' });
}

function openAdd() {
	addStep.value = 'password';
	password.value = null;
	newName.value = null;
	pending.value = null;
	addError.value = null;
	adding.value = true;
}

async function submitPassword() {
	if (!password.value) return;
	busy.value = true;
	addError.value = null;

	try {
		const response = await begin(password.value);

		// Cancelled in the browser: close without an error (FR-008).
		if (!response) {
			adding.value = false;
			return;
		}

		pending.value = response;
		newName.value = defaultName().slice(0, 100);
		addStep.value = 'name';
	} catch (error) {
		addError.value =
			(error as { name?: string })?.name === 'InvalidStateError'
				? { key: 'passkey_already_registered' }
				: { api: error };
	} finally {
		busy.value = false;
	}
}

const nameInvalid = (value: string | null) => !value?.trim() || value.trim().length > 100;

async function submitName() {
	if (!pending.value || nameInvalid(newName.value)) return;
	busy.value = true;
	addError.value = null;

	try {
		await save(pending.value, newName.value!.trim());
		adding.value = false;
	} catch (error) {
		addError.value = { api: error };
	} finally {
		busy.value = false;
	}
}

// Rename (own passkeys only).
const renaming = ref<Passkey | null>(null);
const renameValue = ref<string | null>(null);
const renameError = ref<DialogError>(null);

function openRename(passkey: Passkey) {
	renaming.value = passkey;
	renameValue.value = passkey.name;
	renameError.value = null;
}

async function submitRename() {
	if (!renaming.value || nameInvalid(renameValue.value)) return;
	busy.value = true;

	try {
		await rename(renaming.value.id, renameValue.value!.trim());
		renaming.value = null;
	} catch (error) {
		renameError.value = { api: error };
	} finally {
		busy.value = false;
	}
}

// Delete (own, or another user's for an admin).
const deleting = ref<Passkey | null>(null);
const deleteError = ref<DialogError>(null);

function openDelete(passkey: Passkey) {
	deleting.value = passkey;
	deleteError.value = null;
}

async function submitDelete() {
	if (!deleting.value) return;
	busy.value = true;

	try {
		await remove(deleting.value.id);
		deleting.value = null;
	} catch (error) {
		deleteError.value = { api: error };
	} finally {
		busy.value = false;
	}
}

const menuItems = (passkey: Passkey) => [
	{ text: t('passkey_rename'), icon: 'edit', onSelect: () => openRename(passkey) },
	{ text: t('passkey_delete'), icon: 'delete', danger: true, onSelect: () => openDelete(passkey) },
];
</script>

<template>
	<div
		v-if="visible"
		class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
		data-testid="user-passkeys"
	>
		<div class="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
			<div class="flex min-w-0 items-start gap-3">
				<BoIcon name="passkey" class="mt-0.5 text-gray-500 dark:text-gray-400" />
				<div class="min-w-0">
					<h3 :id="`${id}-title`" class="text-base font-medium text-gray-800 dark:text-white/90">
						{{ $t('passkeys') }}
					</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ $t('passkeys_description') }}</p>
				</div>
			</div>
			<div v-if="isCurrentUser" class="flex flex-col items-end gap-1">
				<BoButton
					size="sm"
					icon="add"
					:disabled="atLimit || loading"
					:aria-describedby="atLimit ? `${id}-limit` : undefined"
					@click="openAdd"
				>
					{{ $t('passkey_add') }}
				</BoButton>
				<p v-if="atLimit" :id="`${id}-limit`" class="text-theme-xs text-gray-500 dark:text-gray-400">
					{{ $t('passkey_limit') }}
				</p>
			</div>
		</div>

		<div class="border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800">
			<BoTable
				:columns="columns"
				:rows="passkeys"
				row-key="id"
				:loading="loading"
				:caption="$t('passkeys')"
				:append-width="56"
			>
				<template #[`item.date_created`]="{ item }">
					<span :title="exact(item.date_created)">{{ relative(item.date_created) }}</span>
				</template>
				<template #[`item.last_used`]="{ item }">
					<span v-if="item.last_used" :title="exact(item.last_used)">{{ relative(item.last_used) }}</span>
					<span v-else>{{ $t('passkey_never_used') }}</span>
				</template>
				<template #item-append="{ item }">
					<BoMenu v-if="isCurrentUser" :items="menuItems(item as Passkey)" align="end">
						<template #trigger>
							<BoButton
								variant="ghost"
								size="sm"
								square
								icon="more_vert"
								:aria-label="`${$t('passkey_actions')}: ${item.name}`"
							/>
						</template>
					</BoMenu>
					<BoButton
						v-else
						variant="ghost"
						size="sm"
						square
						icon="delete"
						:aria-label="`${$t('passkey_delete')}: ${item.name}`"
						@click="openDelete(item as Passkey)"
					/>
				</template>
				<template #empty>
					<div class="flex flex-col items-center gap-1 py-4 text-center">
						<BoIcon name="passkey" class="text-gray-500 dark:text-gray-400" />
						<p class="text-base font-medium text-gray-800 dark:text-white/90">{{ $t('passkey_none') }}</p>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ $t('passkey_none_hint') }}</p>
					</div>
				</template>
			</BoTable>
		</div>

		<BoDialog
			v-model:open="adding"
			:title="addStep === 'password' ? $t('passkey_enter_password') : $t('passkey_name_title')"
		>
			<form v-if="addStep === 'password'" :id="`${id}-password`" @submit.prevent="submitPassword">
				<BoInput
					v-model="password"
					type="password"
					name="password"
					autocomplete="current-password"
					:label="$t('password')"
					autofocus
				/>
			</form>
			<form v-else :id="`${id}-name`" @submit.prevent="submitName">
				<BoInput
					v-model="newName"
					name="passkey-name"
					:label="$t('passkey_name')"
					:maxlength="100"
					:invalid="nameInvalid(newName)"
					autofocus
				/>
			</form>
			<BoNotice v-if="addError" type="danger" class="mt-4">{{ errorText(addError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" @click="adding = false">{{ $t('cancel') }}</BoButton>
				<BoButton
					v-if="addStep === 'password'"
					type="submit"
					:form="`${id}-password`"
					:loading="busy"
					:disabled="!password"
				>
					{{ $t('next') }}
				</BoButton>
				<BoButton v-else type="submit" :form="`${id}-name`" :loading="busy" :disabled="nameInvalid(newName)">
					{{ $t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog :open="renaming !== null" :title="$t('passkey_rename')" @update:open="!$event && (renaming = null)">
			<form :id="`${id}-rename`" @submit.prevent="submitRename">
				<BoInput
					v-model="renameValue"
					name="passkey-rename"
					:label="$t('passkey_name')"
					:maxlength="100"
					:invalid="nameInvalid(renameValue)"
					autofocus
				/>
			</form>
			<BoNotice v-if="renameError" type="danger" class="mt-4">{{ errorText(renameError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" @click="renaming = null">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" :form="`${id}-rename`" :loading="busy" :disabled="nameInvalid(renameValue)">
					{{ $t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog :open="deleting !== null" :title="$t('passkey_delete')" @update:open="!$event && (deleting = null)">
			<p class="text-sm text-gray-700 dark:text-gray-400">
				{{ $t('passkey_delete_confirm', { name: deleting?.name ?? '' }) }}
			</p>
			<p v-if="!isCurrentUser" class="mt-2 text-sm text-gray-700 dark:text-gray-400">
				{{ $t('passkey_admin_delete_text') }}
			</p>
			<BoNotice v-if="deleteError" type="danger" class="mt-4">{{ errorText(deleteError) }}</BoNotice>
			<template #actions>
				<BoButton variant="secondary" @click="deleting = null">{{ $t('cancel') }}</BoButton>
				<BoButton variant="danger" :loading="busy" @click="submitDelete">{{ $t('delete_label') }}</BoButton>
			</template>
		</BoDialog>
	</div>
</template>
