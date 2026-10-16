<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-simple/field-configuration.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-22): the configuration panel of the chosen card; VInput/VSelect/VCheckbox/VButton are the Bo
// components, the key gets the focus when the panel opens. interfaceIdsToInterface reads the apps/web registry.
import { nanoid } from 'nanoid/non-secure';
import { storeToRefs } from 'pinia';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../../components/BoButton.vue';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';
import { useExtension } from '../../../../../../composables/use-extension.ts';
import { getInterfaces } from '../../../../../../interfaces/index.ts';
import ExtensionOptions from '../shared/ExtensionOptions.vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import RelationshipConfiguration from './RelationshipConfiguration.vue';

defineProps<{
	row?: number | null;
}>();

defineEmits(['save', 'toggleAdvanced']);

const fieldDetailStore = useFieldDetailStore();

const { readyToSave, saving, localType } = storeToRefs(fieldDetailStore);

const { t } = useI18n();

const key = syncFieldDetailStoreProperty('field.field');
const type = syncFieldDetailStoreProperty('field.type');
const defaultValue = syncFieldDetailStoreProperty('field.schema.default_value');
const chosenInterface = syncFieldDetailStoreProperty('field.meta.interface');
const required = syncFieldDetailStoreProperty('field.meta.required', false);

const chosenInterfaceConfig = useExtension('interface', chosenInterface);

const typeOptions = computed(() => {
	if (!chosenInterfaceConfig.value) return [];

	return chosenInterfaceConfig.value.types.map((type) => ({
		text: t(type === 'geometry' ? 'geometry.All' : type),
		value: type,
	}));
});

const typeDisabled = computed(() => typeOptions.value.length === 1 || localType.value !== 'standard');

const interfaceIdsToInterface = computed(() => Object.fromEntries(getInterfaces().map((inter) => [inter.id, inter])));

const customOptionsFields = computed(() => {
	if (typeof chosenInterfaceConfig.value?.options === 'function') {
		return (chosenInterfaceConfig.value.options as (context: unknown) => any)(fieldDetailStore);
	}

	return null;
});

watch(
	chosenInterface,
	(newVal, oldVal) => {
		if (!newVal) return;

		if (interfaceIdsToInterface.value[newVal]?.autoKey) {
			const simplifiedId = newVal.includes('-') ? newVal.split('-')[1] : newVal;
			key.value = `${simplifiedId}-${nanoid(6).toLowerCase()}`;
		} else if (oldVal && interfaceIdsToInterface.value[oldVal]?.autoKey) {
			key.value = null;
		}
	},
	{ immediate: true },
);

const options = computed({
	get() {
		return fieldDetailStore.field.meta?.options ?? {};
	},
	set(newOptions: Record<string, any>) {
		fieldDetailStore.update({
			field: {
				meta: {
					options: newOptions,
				},
			},
		});
	},
});

const LABEL = 'mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<div
		class="col-span-full rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6"
		:style="{ 'grid-row': row ?? undefined }"
	>
		<template v-if="chosenInterface && !chosenInterfaceConfig?.autoKey">
			<div class="mb-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
				<div>
					<p :class="LABEL">
						{{ $t('key') }}
						<BoIcon name="star" size="sm" class="text-error-600 dark:text-error-400" :label="$t('required')" />
					</p>
					<BoInput
						v-model="key"
						autofocus
						class="font-mono"
						db-safe
						:aria-label="$t('key')"
						:placeholder="$t('a_unique_column_name')"
					/>
				</div>
				<BoSelect v-model="type" :label="$t('type')" :items="typeOptions" :disabled="typeDisabled" />
				<div>
					<p :class="LABEL">{{ $t('default_value') }}</p>
					<BoCheckbox v-if="type === 'boolean'" v-model="defaultValue" :label="$t('enabled')" />
					<BoInput
						v-else
						v-model="defaultValue"
						class="font-mono"
						:aria-label="$t('default_value')"
						placeholder="NULL"
					/>
				</div>
				<div>
					<p :class="LABEL">{{ $t('required') }}</p>
					<BoCheckbox v-model="required" :label="$t('require_value_to_be_set')" />
				</div>
			</div>
			<RelationshipConfiguration :local-type="localType" />
			<hr class="my-6 border-gray-200 dark:border-gray-800" />
		</template>

		<ExtensionOptions v-model="options" type="interface" :extension="chosenInterface" :options="customOptionsFields" />

		<BoButton class="mt-8" full-width :disabled="!readyToSave" :loading="saving" @click="$emit('save')">
			{{ $t('save') }}
		</BoButton>
		<button
			type="button"
			class="mt-4 w-full rounded text-center text-theme-sm text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-white/90 dark:focus-visible:outline-brand-400"
			@click="$emit('toggleAdvanced')"
		>
			{{ $t('continue_in_advanced_field_creation_mode') }}
		</button>
	</div>
</template>
