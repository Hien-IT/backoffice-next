<!-- Ported from directus/app/src/views/private/components/users-invite.vue -->
<script setup lang="ts">
// Backoffice: user story 3 of feature 015 (FR-063, recipe Q-19). BoDialog with a BoTextarea and a BoSelect; the
// `RECORD_NOT_UNIQUE` errors stay in the dialog (danger notice, as DR), other errors open the error dialog
// (D-66). The roles load when the dialog opens. No role at all leaves the select empty and the invite goes without
// `role` (CHK019). A successful invite also emits `invited` so the screen can reload and then show the "no email"
// notice (D-83): this system sends no invitation email.
import type { Role } from '@directus/types';
import { ref, watch } from 'vue';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSelect from '../../../components/BoSelect.vue';
import BoTextarea from '../../../components/BoTextarea.vue';
import { showUnexpectedError } from '../../../composables/use-notices.ts';

type ApiError = { message?: string; extensions?: { code?: string; invalid?: string } };

const props = defineProps<{
	modelValue: boolean;
	role?: string | undefined;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'invited'): void;
}>();

const emails = ref<string>('');
const roles = ref<{ text: string; value: string }[]>([]);
const roleSelected = ref<string | null>(props.role ?? null);
const loading = ref(false);

const uniqueValidationErrors = ref<ApiError[]>([]);

watch(
	() => props.modelValue,
	() => {
		loadRoles();
	},
);

function errorsOf(error: unknown): ApiError[] {
	const value = error as { errors?: ApiError[]; response?: { data?: { errors?: ApiError[] } } } | null;
	return value?.errors ?? value?.response?.data?.errors ?? [];
}

async function inviteUsers() {
	if (emails.value.length === 0 || loading.value) return;

	loading.value = true;

	try {
		const emailsParsed = emails.value
			.split(/,|\n/)
			.filter((e) => e)
			.map((email) => email.trim());

		await sdk.request(
			requestEndpoint('/users/invite', {
				method: 'POST',
				body: { email: emailsParsed, role: roleSelected.value ?? undefined },
			}),
		);

		emails.value = '';
		uniqueValidationErrors.value = [];
		emit('update:modelValue', false);
		emit('invited');
	} catch (error) {
		const errors = errorsOf(error);

		uniqueValidationErrors.value = errors.filter((e) => e.extensions?.code === 'RECORD_NOT_UNIQUE');

		const otherErrors = errors.filter((e) => e?.extensions?.code !== 'RECORD_NOT_UNIQUE');

		if (otherErrors.length > 0) {
			otherErrors.forEach((e) => showUnexpectedError({ errors: [e] }));
		} else if (errors.length === 0) {
			showUnexpectedError(error);
		}
	} finally {
		loading.value = false;
	}
}

async function loadRoles() {
	try {
		const response = await sdk.request(
			requestEndpoint<Pick<Role, 'id' | 'name'>[]>('/roles', {
				method: 'GET',
				params: { sort: 'name', fields: ['id', 'name'] },
			}),
		);

		roles.value = response.map((role) => ({
			text: role.name,
			value: role.id,
		}));

		if (roles.value.length > 0 && !roleSelected.value) {
			roleSelected.value = roles.value[0]?.value ?? null;
		}
	} catch (error) {
		showUnexpectedError(error);
	}
}
</script>

<template>
	<BoDialog :open="modelValue" :title="$t('invite_users')" @update:open="$emit('update:modelValue', $event)">
		<form id="users-invite-form" class="flex flex-col gap-5" @submit.prevent="inviteUsers">
			<BoTextarea
				v-model="emails"
				:label="$t('emails')"
				:rows="4"
				placeholder="admin@example.com, user@example.com..."
				@keydown.meta.enter.prevent="inviteUsers"
				@keydown.ctrl.enter.prevent="inviteUsers"
			/>
			<BoSelect v-if="!role" v-model="roleSelected" :label="$t('role')" :items="roles" />
			<BoNotice v-if="uniqueValidationErrors.length > 0" type="danger">
				<span v-for="(err, i) in uniqueValidationErrors" :key="i" class="block">
					<template v-if="err.extensions?.invalid">
						{{ $t('email_already_invited', { email: err.extensions.invalid }) }}
					</template>
					<template v-else-if="i === 0">
						{{ $t('validationError.unique') }}
					</template>
				</span>
			</BoNotice>
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="$emit('update:modelValue', false)">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="users-invite-form" :disabled="emails.length === 0" :loading="loading">
				{{ $t('invite') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
