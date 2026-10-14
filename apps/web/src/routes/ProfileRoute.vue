<script setup lang="ts">
// Profile page /users/me (FR-060, D-48): a fixed form instead of the directus_users item form of the Users module
// (directus/app/src/modules/users/routes/item.vue). Like item.vue it sends only the edited fields, shows
// FAILED_VALIDATION and RECORD_NOT_UNIQUE on their field (form-field.vue messages) and hydrates the user store after
// saving, whose language watcher applies the new language. Field labels and choices are the Directus ones.
import { uploadFiles } from '@directus/sdk';
import { isEqual } from 'lodash-es';
import { computed, reactive, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import BoAvatar from '../components/BoAvatar.vue';
import BoButton from '../components/BoButton.vue';
import BoIcon from '../components/BoIcon.vue';
import BoInput from '../components/BoInput.vue';
import BoNotice from '../components/BoNotice.vue';
import BoProgressCircular from '../components/BoProgressCircular.vue';
import BoSelect from '../components/BoSelect.vue';
import availableLanguages from '../lang/available-languages.json';
import { translateAPIError } from '../lang/index.ts';
import PrivateView from '../layout/PrivateView.vue';
import { useUserStore } from '../stores/user.ts';
import type { AppUser } from '../types/user.ts';

type Field = (typeof FIELDS)[number];
type ApiErrorItem = { extensions?: { code?: string; field?: string; type?: string } & Record<string, unknown> };

const FIELDS = [
	'first_name',
	'last_name',
	'email',
	'password',
	'avatar',
	'language',
	'appearance',
	'theme_light_overrides',
	'theme_dark_overrides',
] as const;

const TEXT_FIELDS = ['first_name', 'last_name', 'email'] as const;
const SELECT_FIELDS = ['language', 'appearance'] as const;
const JSON_FIELDS = ['theme_light_overrides', 'theme_dark_overrides'] as const;

// Reka UI items cannot have an empty value: this one stands for null ("use the project default").
const DEFAULT = 'default';

const { t, te } = useI18n();
const userStore = useUserStore();
const id = useId();

const user = computed(() => {
	const current = userStore.currentUser;
	return current && !('share' in current) ? current : null;
});

const form = reactive({
	first_name: '',
	last_name: '',
	email: '',
	password: '',
	avatar: null as string | null,
	language: DEFAULT,
	appearance: DEFAULT,
	theme_light_overrides: '',
	theme_dark_overrides: '',
});

const fieldErrors = ref<Partial<Record<Field, string>>>({});
const error = ref<unknown>(null);
const saving = ref(false);
const uploading = ref(false);

// system-language interface with includeProjectDefault, and the appearance choices of directus_users.
const selectItems = computed(() => ({
	language: [
		{ text: t('fields.directus_settings.default_language'), value: DEFAULT },
		...Object.entries(availableLanguages).map(([value, text]) => ({ text, value })),
	],
	appearance: [
		{ text: t('default_sync_with_project'), value: DEFAULT },
		{ text: t('appearance_auto'), value: 'auto' },
		{ text: t('appearance_light'), value: 'light' },
		{ text: t('appearance_dark'), value: 'dark' },
	],
}));

watch(user, (current) => current && reset(current), { immediate: true });

function reset(current: AppUser) {
	Object.assign(form, {
		first_name: current.first_name ?? '',
		last_name: current.last_name ?? '',
		email: current.email ?? '',
		password: '',
		avatar: current.avatar?.id ?? null,
		language: current.language ?? DEFAULT,
		appearance: current.appearance ?? DEFAULT,
		theme_light_overrides: toJson(current.theme_light_overrides),
		theme_dark_overrides: toJson(current.theme_dark_overrides),
	});

	fieldErrors.value = {};
}

function toJson(value: unknown) {
	return value == null ? '' : JSON.stringify(value, null, 2);
}

/** Edited fields against the current user (an emptied input is null, like Directus inputs) and invalid JSON fields. */
const changes = computed(() => {
	const edits: Record<string, unknown> = {};
	const invalid: Field[] = [];
	const current = user.value;

	if (!current) return { edits, invalid };

	for (const field of TEXT_FIELDS) {
		const value = form[field] === '' ? null : form[field];
		if (value !== (current[field] ?? null)) edits[field] = value;
	}

	if (form.password) edits['password'] = form.password;

	if (form.avatar !== (current.avatar?.id ?? null)) edits['avatar'] = form.avatar;

	for (const field of SELECT_FIELDS) {
		const value = form[field] === DEFAULT ? null : form[field];
		if (value !== (current[field] ?? null)) edits[field] = value;
	}

	for (const field of JSON_FIELDS) {
		try {
			const value = form[field].trim() ? JSON.parse(form[field]) : null;
			// A field missing from /users/me counts as null (nothing to send for an untouched empty field).
			if (!isEqual(value, current[field] ?? null)) edits[field] = value;
		} catch {
			invalid.push(field);
		}
	}

	return { edits, invalid };
});

const hasChanges = computed(() => Object.keys(changes.value.edits).length > 0 || changes.value.invalid.length > 0);

async function save() {
	const { edits, invalid } = changes.value;

	error.value = null;
	fieldErrors.value = Object.fromEntries(invalid.map((field) => [field, t('invalid_input')]));

	if (invalid.length > 0 || Object.keys(edits).length === 0) return;

	saving.value = true;

	try {
		await sdk.request(requestEndpoint('/users/me', { method: 'PATCH', body: edits }));
		await userStore.hydrate();
	} catch (err: unknown) {
		setErrors(err);
	} finally {
		saving.value = false;
	}
}

// Messages of form-field.vue (validationMessage).
function validationMessage(extensions: NonNullable<ApiErrorItem['extensions']>) {
	if (extensions.code === 'RECORD_NOT_UNIQUE') return t('validationError.unique');

	const key = `validationError.${extensions.type}`;
	return te(key) ? t(key, extensions) : translateAPIError(extensions.code ?? null);
}

function setErrors(err: unknown) {
	const items = (err as { errors?: unknown } | null)?.errors;
	const errors: Partial<Record<Field, string>> = {};
	const rest: ApiErrorItem[] = [];

	for (const item of Array.isArray(items) ? (items as ApiErrorItem[]) : []) {
		const extensions = item?.extensions;
		const field = extensions?.field as Field | undefined;

		if (
			extensions &&
			(extensions.code === 'FAILED_VALIDATION' || extensions.code === 'RECORD_NOT_UNIQUE') &&
			field &&
			FIELDS.includes(field)
		) {
			errors[field] = validationMessage(extensions);
		} else {
			rest.push(item);
		}
	}

	fieldErrors.value = errors;
	error.value = Object.keys(errors).length === 0 ? err : rest.length > 0 ? { errors: rest } : null;
}

async function uploadAvatar(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];

	if (!file) return;

	const formData = new FormData();
	formData.append('file', file);

	uploading.value = true;
	error.value = null;

	try {
		const uploaded = (await sdk.request(uploadFiles(formData, { fields: ['id'] }))) as { id: string };
		form.avatar = uploaded.id;
	} catch (err: unknown) {
		error.value = err;
	} finally {
		uploading.value = false;
		input.value = '';
	}
}
</script>

<template>
	<PrivateView :title="$t('profile')" icon="account_circle">
		<form v-if="user" class="grid max-w-4xl gap-eh-6 p-eh-6 md:grid-cols-2" @submit.prevent="save">
			<BoInput
				v-model="form.first_name"
				name="first_name"
				autocomplete="given-name"
				:label="$t('fields.directus_users.first_name')"
				:error="fieldErrors.first_name ?? ''"
			/>
			<BoInput
				v-model="form.last_name"
				name="last_name"
				autocomplete="family-name"
				:label="$t('fields.directus_users.last_name')"
				:error="fieldErrors.last_name ?? ''"
			/>
			<BoInput
				v-model="form.email"
				type="email"
				name="email"
				autocomplete="email"
				:label="$t('fields.directus_users.email')"
				:error="fieldErrors.email ?? ''"
			/>
			<BoInput
				v-model="form.password"
				type="password"
				name="password"
				autocomplete="new-password"
				:label="$t('fields.directus_users.password')"
				:error="fieldErrors.password ?? ''"
			/>

			<div class="flex flex-col gap-eh-1 md:col-span-2">
				<label :for="`${id}-avatar`" class="text-eh-sm font-semibold text-eh-text-primary">
					{{ $t('fields.directus_users.avatar') }}
				</label>
				<div class="flex flex-wrap items-center gap-eh-4">
					<BoAvatar :avatar-id="form.avatar" :name="userStore.fullName ?? ''" />
					<input
						:id="`${id}-avatar`"
						type="file"
						name="avatar"
						accept="image/*"
						:disabled="uploading"
						:aria-describedby="fieldErrors.avatar ? `${id}-avatar-error` : undefined"
						class="text-eh-sm text-eh-text-primary file:me-eh-3 file:h-eh-10 file:cursor-pointer file:rounded-eh-md file:border file:border-eh-border file:bg-eh-surface-default file:px-eh-3 file:text-eh-text-primary disabled:opacity-50"
						@change="uploadAvatar"
					/>
					<BoProgressCircular v-if="uploading" indeterminate :aria-label="$t('loading')" />
					<BoButton v-if="form.avatar" variant="secondary" :disabled="uploading" @click="form.avatar = null">
						{{ $t('remove') }}
					</BoButton>
				</div>
				<p
					v-if="fieldErrors.avatar"
					:id="`${id}-avatar-error`"
					role="alert"
					class="flex items-center gap-eh-1 text-eh-sm text-eh-text-primary"
				>
					<BoIcon name="error" size="sm" class="text-eh-status-danger" />
					{{ fieldErrors.avatar }}
				</p>
			</div>

			<div v-for="field in SELECT_FIELDS" :key="field" class="flex flex-col gap-eh-1">
				<BoSelect v-model="form[field]" :items="selectItems[field]" :label="$t(`fields.directus_users.${field}`)" />
				<p v-if="fieldErrors[field]" role="alert" class="flex items-center gap-eh-1 text-eh-sm text-eh-text-primary">
					<BoIcon name="error" size="sm" class="text-eh-status-danger" />
					{{ fieldErrors[field] }}
				</p>
			</div>

			<div v-for="field in JSON_FIELDS" :key="field" class="flex flex-col gap-eh-1 md:col-span-2">
				<label :for="`${id}-${field}`" class="text-eh-sm font-semibold text-eh-text-primary">
					{{ $t(`fields.directus_users.${field}`) }}
				</label>
				<textarea
					:id="`${id}-${field}`"
					v-model="form[field]"
					:name="field"
					rows="6"
					spellcheck="false"
					:aria-invalid="fieldErrors[field] ? 'true' : undefined"
					:aria-describedby="fieldErrors[field] ? `${id}-${field}-error` : undefined"
					class="w-full rounded-eh-md border border-eh-border bg-eh-surface-default p-eh-3 font-mono text-eh-sm text-eh-text-primary aria-invalid:border-eh-status-danger"
				/>
				<p
					v-if="fieldErrors[field]"
					:id="`${id}-${field}-error`"
					role="alert"
					class="flex items-center gap-eh-1 text-eh-sm text-eh-text-primary"
				>
					<BoIcon name="error" size="sm" class="text-eh-status-danger" />
					{{ fieldErrors[field] }}
				</p>
			</div>

			<BoNotice v-if="error" type="danger" class="md:col-span-2">{{ translateAPIError(error) }}</BoNotice>

			<div class="md:col-span-2">
				<BoButton type="submit" icon="check" :loading="saving" :disabled="!hasChanges || uploading">
					{{ $t('save') }}
				</BoButton>
			</div>
		</form>
	</PrivateView>
</template>
