// Ported from directus/app/src/routes/setup/form.ts
// Backoffice: the owner fields only (useFormFields(false), no license step, D-53); the register fields stay in the 012
// SetupRoute, which folds the form in. The email check is a plain pattern instead of zod (not a dependency of the app);
// the API validates the address again.
import type { DeepPartial, Field } from '@directus/types';
import { computed, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { validateItem } from '../../../components/form/utils/validate-item.ts';

export type OwnerForm = {
	project_owner?: string | null;
	project_usage?: 'personal' | 'commercial' | 'community' | null;
	org_name?: string | null;
	product_updates?: boolean | null;
};

export type ValidationError = { field: string; path: unknown[]; type: string; [key: string]: unknown };

// shortcut: not a full RFC 5322 check (DR uses z.email()), the API validates the address again.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(value: Record<string, any>, fields: Field[]): ValidationError[] {
	let errors = validateItem(value, fields, true) as unknown as ValidationError[];

	if (!EMAIL_PATTERN.test(value['project_owner'] ?? '')) {
		errors.push({ field: 'project_owner', path: [], type: 'email' });
	}

	errors = errors.map((error) => {
		if (error.field === 'org_name' && (error.type === 'nnull' || error.type === 'required')) {
			error.type = 'org_name';
		}

		return error;
	});

	return errors;
}

export function useFormFields(value: Ref<OwnerForm>, initialValues?: Ref<OwnerForm>): ComputedRef<Field[]> {
	const { t } = useI18n();

	return computed(() => {
		const fields: DeepPartial<Field>[] = [];

		fields.push({
			field: 'project_owner',
			name: t('owner_email'),
			meta: {
				required: true,
				interface: 'input',
				options: {
					placeholder: t('email_address'),
				},
				width: 'full',
			},
		});

		fields.push({
			field: 'project_usage',
			name: t('how_do_you_use_directus'),
			meta: {
				required: false,
				interface: 'select-dropdown',
				options: {
					items: [
						{ icon: 'account_circle', value: 'personal', text: t('usage_personal') },
						{ icon: 'domain', value: 'commercial', text: t('usage_commercial') },
						{ icon: 'groups', value: 'community', text: t('usage_community') },
					],
				},
				width: 'full',
			},
		});

		if ((value.value?.project_usage ?? initialValues?.value?.project_usage) === 'commercial')
			fields.push({
				field: 'org_name',
				name: t('organization_name'),
				meta: {
					required: true,
					interface: 'input',
					options: {},
					width: 'full',
				},
			});

		return fields as Field[];
	});
}
