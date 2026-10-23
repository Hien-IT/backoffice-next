<!-- Ported from directus/app/src/routes/setup/setup.vue -->
<script setup lang="ts">
// Backoffice: the form of routes/setup/form.vue and the fields and validation of routes/setup/form.ts are folded in
// as plain fields (no v-form); the email check is a plain pattern instead of zod (not a dependency of the app). The
// license notice and checkbox are left out (no license step, D-53), so the payload has no `license` key; the usage
// select and the organization name it shows for commercial use are left out too (owner 2026-10-22, D-165), so
// `project_usage` and `org_name` are always null; the other keys and values are those of DR. Requests go through
// the SDK.
import { useHead } from '@unhead/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { login } from '../auth.ts';
import BoButton from '../components/BoButton.vue';
import BoInput from '../components/BoInput.vue';
import BoNotice from '../components/BoNotice.vue';
import { translateAPIError } from '../lang/index.ts';
import PublicView from '../layout/PublicView.vue';

type Form = {
	first_name: string | null;
	last_name: string | null;
	project_owner: string | null;
	password: string | null;
	password_confirm: string | null;
	project_usage: null;
	org_name: null;
	product_updates: boolean;
};

type ValidationError = { field: keyof Form; type: string };

// shortcut: not a full RFC 5322 check (DR uses z.email()), the API validates the address again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const { t } = useI18n();

useHead({
	title: t('setup_project'),
});

const form = ref<Form>({
	first_name: null,
	last_name: null,
	project_owner: null,
	password: null,
	password_confirm: null,
	project_usage: null,
	org_name: null,
	product_updates: false,
});

const router = useRouter();

const errors = ref<ValidationError[]>([]);
const error = ref<any>(null);
const isSaving = ref(false);

// form.ts validate(register = true): the required fields are complete once the button is enabled (formComplete).
function validate(value: Form): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!EMAIL_PATTERN.test(value.project_owner ?? '')) {
		errors.push({ field: 'project_owner', type: 'email' });
	}

	if (value.password !== value.password_confirm) {
		errors.push({ field: 'password_confirm', type: 'confirm_password' });
	}

	return errors;
}

// An empty string is no error for BoInput.
function fieldError(field: keyof Form): string {
	const fieldErrors = errors.value.find((error) => error.field === field);
	return fieldErrors ? t(`validationError.${fieldErrors.type}`) : '';
}

async function launch() {
	errors.value = validate(form.value);

	if (errors.value.length > 0) return;

	try {
		isSaving.value = true;
		await sdk.request(requestEndpoint('/server/setup', { method: 'POST', body: form.value }));

		await login({
			credentials: {
				email: form.value.project_owner!,
				password: form.value.password!,
			},
		});

		router.push('/content');
	} catch (err: any) {
		error.value = err;
	} finally {
		isSaving.value = false;
	}
}

const errorMessage = computed(() => {
	return error.value?.errors?.[0]?.message || error.value?.message || t('unexpected_error');
});

// FormValidator of form.ts without the license literal.
const formComplete = computed(() => {
	const { first_name, last_name, project_owner, password, password_confirm } = form.value;

	return (
		[first_name, last_name, password, password_confirm].every((value) => typeof value === 'string') &&
		EMAIL_PATTERN.test(project_owner ?? '')
	);
});
</script>

<template>
	<PublicView>
		<form novalidate class="flex flex-col gap-5" @submit.prevent="launch">
			<h1 class="text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
				{{ $t('setup_welcome') }}
			</h1>
			<p class="mb-2 text-gray-500 dark:text-gray-400">{{ $t('setup_info') }}</p>

			<BoInput
				v-model="form.first_name"
				name="first_name"
				autocomplete="given-name"
				:label="$t('first_name')"
				:placeholder="$t('first_name')"
			/>
			<BoInput
				v-model="form.last_name"
				name="last_name"
				autocomplete="family-name"
				:label="$t('last_name')"
				:placeholder="$t('last_name')"
			/>
			<BoInput
				v-model="form.project_owner"
				type="email"
				name="project_owner"
				autocomplete="email"
				:label="$t('admin_email')"
				:placeholder="$t('email_address')"
				:error="fieldError('project_owner')"
			/>
			<BoInput
				v-model="form.password"
				type="password"
				name="password"
				autocomplete="new-password"
				:label="$t('password')"
			/>
			<BoInput
				v-model="form.password_confirm"
				type="password"
				name="password_confirm"
				autocomplete="new-password"
				:label="$t('confirm_password')"
				:error="fieldError('password_confirm')"
			/>

			<label class="flex items-start gap-3 font-medium text-gray-700 dark:text-gray-400">
				<input
					v-model="form.product_updates"
					type="checkbox"
					name="product_updates"
					class="mt-0.5 size-4 shrink-0 rounded-sm accent-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
				/>
				{{ $t('setup_marketing_emails') }}
			</label>

			<BoButton type="submit" icon="rocket_launch" full-width :disabled="!formComplete" :loading="isSaving">
				{{ $t('setup_launch') }}
			</BoButton>

			<BoNotice v-if="error" type="danger">
				<p class="mb-1 font-semibold">
					{{ translateAPIError(error) }}
				</p>
				<p>
					{{ errorMessage }}
				</p>
			</BoNotice>
		</form>
	</PublicView>
</template>
