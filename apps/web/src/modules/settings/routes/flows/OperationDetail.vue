<!-- Ported from directus/app/src/modules/settings/routes/flows/components/operation-detail.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-040 to FR-043, recipe Q-31): VDrawer is BoDrawer (persistent, `apply` = meta+Enter), VInput
// is BoInput (`dbSafe` for the key, the uniqueness error linked to the field; no decorative `title` / `vpn_key` icons), VFancySelect is BoFancySelect, VNotice is
// BoNotice; the operations come from the static registry (no extensions, XI) and are translated here, as the Directus
// extension store does when it registers them. `mail` shows the D-106 notice above its options.
import type { Field, FlowRaw } from '@directus/types';
import slugify from '@sindresorhus/slugify';
import { customAlphabet } from 'nanoid/non-secure';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../components/BoButton.vue';
import BoFancySelect from '../../../../components/BoFancySelect.vue';
import BoInput from '../../../../components/BoInput.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoDrawer from '../../../../components/drawers/BoDrawer.vue';
import { getDefaultValuesFromFields } from '../../../../components/form/utils/get-default-values-from-fields.ts';
import { useDialogRoute } from '../../../../composables/use-dialog-route.ts';
import { getOperation, getOperations } from '../../../../operations/index.ts';
import { translate } from '../../../../utils/translate-object-values.ts';
import ExtensionOptions from '../data-model/field-detail/shared/ExtensionOptions.vue';

const generateSuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 5);

const props = withDefaults(
	defineProps<{
		primaryKey: string;
		operationId: string;
		operation?: Record<string, any> | undefined;
		existingOperationKeys?: string[] | undefined;
		flow: FlowRaw;
	}>(),
	{
		operation: undefined,
		existingOperationKeys: undefined,
	},
);

const emit = defineEmits<{ save: [operation: Record<string, any>]; cancel: [] }>();

const isOpen = useDialogRoute();
const { t } = useI18n();

const options = ref<Record<string, any>>(props.operation?.['options'] ?? {});
const operationType = ref<string | null>(props.operation?.['type'] ?? null);
const operationKey = ref<string | null>(props.operation?.['key'] ?? null);
const operationName = ref<string | null>(props.operation?.['name'] ?? null);

const saving = ref(false);

const isOperationKeyUnique = computed(
	() =>
		saving.value ||
		operationKey.value === null ||
		!(props.operation?.['key'] !== operationKey.value && props.existingOperationKeys?.includes(operationKey.value)),
);

const saveDisabled = computed(() => {
	return !operationType.value || !isOperationKeyUnique.value;
});

watch(
	() => props.operation,
	(operation) => {
		if (!operation) return;

		options.value = operation['options'];
		operationType.value = operation['type'];
		operationKey.value = operation['key'];
		operationName.value = operation['name'];
	},
	{ immediate: true, deep: true },
);

watch(operationType, () => {
	options.value = {};
});

watch(
	operationName,
	(newName, oldName) => {
		if (
			newName === null ||
			operationKey.value ===
				slugify(oldName ?? '', {
					separator: '_',
				})
		) {
			operationKey.value = slugify(newName ?? '', {
				separator: '_',
			});
		}
	},
	{ immediate: true },
);

const selectedOperation = computed(() => {
	const operation = getOperation(operationType.value);
	return operation ? (translate(operation) as typeof operation) : undefined;
});

const generatedName = computed(() => (selectedOperation.value ? selectedOperation.value.name : t('operation_name')));

const generatedKey = computed(() =>
	selectedOperation.value
		? slugify(selectedOperation.value.id + '_' + generateSuffix(), { separator: '_' })
		: t('operation_key'),
);

const displayOperations = computed(() =>
	getOperations().map((operation) => {
		const translated = translate(operation) as typeof operation;
		return {
			value: translated.id,
			icon: translated.icon,
			text: translated.name,
			description: translated.description,
		};
	}),
);

const operationOptions = computed(() => {
	if (typeof selectedOperation.value?.options === 'function') {
		return translate(selectedOperation.value.options(options.value)) as Field[];
	} else if (Array.isArray(selectedOperation.value?.options)) {
		return selectedOperation.value.options as Field[];
	}

	return undefined;
});

function saveOperation() {
	if (saveDisabled.value) return;

	saving.value = true;

	const defaultValues = operationOptions.value ? getDefaultValuesFromFields(operationOptions.value).value : null;

	emit('save', {
		flow: props.primaryKey,
		name: operationName.value || generatedName.value,
		key: operationKey.value || generatedKey.value,
		type: operationType.value,
		options: { ...defaultValues, ...options.value },
	});
}
</script>

<template>
	<BoDrawer
		:model-value="isOpen"
		:title="$t(operationId === '+' ? 'create_operation' : 'edit_operation')"
		:subtitle="flow.name"
		icon="offline_bolt"
		persistent
		@cancel="emit('cancel')"
		@apply="saveOperation"
		@update:model-value="!$event && emit('cancel')"
	>
		<template #actions>
			<BoButton
				icon="check"
				:aria-label="$t('done')"
				:title="$t('done')"
				:disabled="saveDisabled"
				@click="saveOperation"
			/>
		</template>

		<div class="flex flex-col gap-6 p-6">
			<div class="grid grid-cols-2 gap-6">
				<BoInput v-model="operationName" :label="$t('name')" autofocus :placeholder="generatedName" />
				<BoInput
					v-model="operationKey"
					class="font-mono"
					:label="$t('key')"
					db-safe
					:placeholder="generatedKey"
					v-bind="isOperationKeyUnique ? {} : { error: $t('operation_key_unique_error') }"
				/>
			</div>

			<hr class="m-0 border-gray-200 dark:border-gray-800" />

			<BoFancySelect
				:model-value="operationType"
				:items="displayOperations"
				@update:model-value="operationType = $event as string | null"
			/>

			<BoNotice v-if="operationType && !selectedOperation" type="danger">
				<span class="flex flex-wrap items-center gap-3">
					{{ $t('operation_not_found', { operation: operationType }) }}
					<button
						type="button"
						class="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
						@click="operationType = null"
					>
						{{ $t('reset_interface') }}
					</button>
				</span>
			</BoNotice>

			<template v-if="operationType && selectedOperation && operationOptions">
				<BoNotice v-if="operationType === 'mail'" type="info">{{ $t('operations_mail_not_sent_notice') }}</BoNotice>
				<ExtensionOptions
					v-model="options"
					:extension="operationType"
					:options="operationOptions"
					raw-editor-enabled
					type="operation"
				/>
			</template>
		</div>
	</BoDrawer>
</template>
