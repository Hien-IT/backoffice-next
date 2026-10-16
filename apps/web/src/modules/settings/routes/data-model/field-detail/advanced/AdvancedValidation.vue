<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-validation.vue -->
<script setup lang="ts">
// Backoffice: VForm is BoForm, VNotice BoNotice.
import type { DeepPartial, Field } from '@directus/types';
import { isEqual } from 'lodash-es';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import BoForm from '../../../../../../components/form/BoForm.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';

const fieldDetailStore = useFieldDetailStore();

const { loading, collection, field } = storeToRefs(fieldDetailStore);

const { t } = useI18n();

const validation = syncFieldDetailStoreProperty('field.meta.validation');
const validationMessage = syncFieldDetailStoreProperty('field.meta.validation_message');

const validationSync = computed({
	get() {
		return {
			validation: validation.value,
			validationMessage: validationMessage.value,
		};
	},
	set(value) {
		if (!isEqual(value.validation, validation.value)) validation.value = value.validation;
		if (!isEqual(value.validationMessage, validationMessage.value)) validationMessage.value = value.validationMessage;
	},
});

const validationInitial = validationSync.value;

const fields = computed<DeepPartial<Field>[]>(() => [
	{
		field: 'validation',
		name: t('validation'),
		type: 'json',
		meta: {
			interface: 'system-filter',
			options: {
				collectionName: collection.value,
				fieldName: field.value.field,
				includeFunctions: true,
				includeValidation: true,
			},
		},
	},
	{
		field: 'validationMessage',
		name: t('custom_validation_message'),
		type: 'string',
		meta: {
			interface: 'system-input-translated-string',
		},
	},
]);
</script>

<template>
	<BoNotice v-if="!field.field">{{ $t('configure_field_key_to_continue') }}</BoNotice>

	<BoForm
		v-else
		v-model="validationSync"
		:initial-values="validationInitial"
		:fields="fields as Field[]"
		:loading="loading"
	/>
</template>
