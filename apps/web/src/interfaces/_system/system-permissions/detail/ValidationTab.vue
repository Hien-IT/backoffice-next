<!-- Ported from directus/app/src/interfaces/_system/system-permissions/detail/components/validation.vue -->
<script setup lang="ts">
// Backoffice: VForm is BoForm, VNotice BoNotice.
import type { DeepPartial, Field, Permission, Policy } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoNotice from '../../../../components/BoNotice.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import AppMinimal from './AppMinimal.vue';

const props = defineProps<{
	permission: Permission;
	policy?: Policy | undefined;
	appMinimal?: Permission['validation'] | undefined;
}>();

const emit = defineEmits(['update:permission']);

const { t } = useI18n();

const permissionLocal = ref({ validation: props.permission.validation });
const permissionInitial = permissionLocal.value;

const permissionSync = computed({
	get() {
		return permissionLocal.value;
	},
	set(value) {
		permissionLocal.value = value;

		emit('update:permission', {
			...props.permission,
			validation: value.validation !== undefined ? value.validation : permissionInitial.validation,
		});
	},
});

const fields = computed<DeepPartial<Field>[]>(() => [
	{
		field: 'validation',
		name: t('rule'),
		type: 'json',
		meta: {
			interface: 'system-filter',
			options: {
				collectionName: props.permission.collection,
				includeValidation: true,
				includeRelations: false,
				rawFieldNames: true,
			},
		},
	},
]);
</script>

<template>
	<div>
		<BoNotice>
			{{
				t('validation_for_policy', {
					action: t(permission.action).toLowerCase(),
					policy: policy ? policy.name : t('public_label'),
				})
			}}
		</BoNotice>

		<BoForm v-model="permissionSync" :initial-values="permissionInitial" :fields="fields as Field[]" class="mt-6" />

		<AppMinimal :value="appMinimal" />
	</div>
</template>
