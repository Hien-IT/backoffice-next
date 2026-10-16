<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-schema.vue -->
<script setup lang="ts">
// Backoffice: VInput/VSelect/VCheckbox/VTextarea are the Bo components; BoSelect values are strings, so the null
// "do nothing" choice and the boolean default values go through string keys (`asKey` / `fromKey`); the type list
// has no dividers (BoSelect has none). Required marks are a star with an sr-only text.
import type { Type } from '@directus/types';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { type TranslateResult, useI18n } from 'vue-i18n';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { translate } from '../../../../../../utils/translate-object-values.ts';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../../../components/BoIcon.vue';
import BoInput from '../../../../../../components/BoInput.vue';
import BoSelect from '../../../../../../components/BoSelect.vue';
import BoTextarea from '../../../../../../components/BoTextarea.vue';
import InterfaceInputCode from '../../../../../../interfaces/input-code/InputCode.vue';

type FieldTypeOption = { value: Type; text: TranslateResult | string; children?: FieldTypeOption[] };

const fieldTypes: Array<FieldTypeOption | { divider: true }> = [
	{
		text: '$t:string',
		value: 'string',
	},
	{
		text: '$t:text',
		value: 'text',
	},
	{ divider: true },
	{
		text: '$t:boolean',
		value: 'boolean',
	},
	{ divider: true },
	{
		text: '$t:integer',
		value: 'integer',
	},
	{
		text: '$t:bigInteger',
		value: 'bigInteger',
	},
	{
		text: '$t:float',
		value: 'float',
	},
	{
		text: '$t:decimal',
		value: 'decimal',
	},
	{ divider: true },
	{
		text: '$t:timestamp',
		value: 'timestamp',
	},
	{
		text: '$t:datetime',
		value: 'dateTime',
	},
	{
		text: '$t:date',
		value: 'date',
	},
	{
		text: '$t:time',
		value: 'time',
	},
	{ divider: true },
	{
		text: '$t:json',
		value: 'json',
	},
	{
		text: '$t:csv',
		value: 'csv',
	},
	{
		text: '$t:uuid',
		value: 'uuid',
	},
	{
		text: '$t:hash',
		value: 'hash',
	},
	{ divider: true },
	{
		text: '$t:geometry.All',
		value: 'geometry',
	},
	{
		text: '$t:geometry.Point',
		value: 'geometry.Point',
	},
	{
		text: '$t:geometry.LineString',
		value: 'geometry.LineString',
	},
	{
		text: '$t:geometry.Polygon',
		value: 'geometry.Polygon',
	},
	{
		text: '$t:geometry.MultiPoint',
		value: 'geometry.MultiPoint',
	},
	{
		text: '$t:geometry.MultiLineString',
		value: 'geometry.MultiLineString',
	},
	{
		text: '$t:geometry.MultiPolygon',
		value: 'geometry.MultiPolygon',
	},
];

const fieldDetailStore = useFieldDetailStore();

const { localType, relations, editing } = storeToRefs(fieldDetailStore);

const isExisting = computed(() => editing.value !== '+');

const type = syncFieldDetailStoreProperty('field.type');
const defaultValue = syncFieldDetailStoreProperty('field.schema.default_value');
const field = syncFieldDetailStoreProperty('field.field');
const special = syncFieldDetailStoreProperty('field.meta.special');
const maxLength = syncFieldDetailStoreProperty('field.schema.max_length');
const numericPrecision = syncFieldDetailStoreProperty('field.schema.numeric_precision');
const nullable = syncFieldDetailStoreProperty('field.schema.is_nullable', true);
const unique = syncFieldDetailStoreProperty('field.schema.is_unique', false);
const indexed = syncFieldDetailStoreProperty('field.schema.is_indexed', false);
const numericScale = syncFieldDetailStoreProperty('field.schema.numeric_scale');

const { t } = useI18n();

const typesWithLabels = computed(() => translate(fieldTypes));

const typeDisabled = computed(() => localType.value !== 'standard');

const typePlaceholder = computed(() => {
	if (localType.value === 'm2o') {
		return t('determined_by_relationship');
	}

	return t('choose_a_type');
});

const { onCreateOptions, onCreateValue } = useOnCreate();
const { onUpdateOptions, onUpdateValue } = useOnUpdate();

const hasCreateUpdateTriggers = computed(() => {
	return ['uuid', 'date', 'time', 'dateTime', 'timestamp'].includes(type.value) && localType.value !== 'file';
});

const isAlias = computed(() => {
	return !fieldDetailStore.field.schema;
});

const isPrimaryKey = computed(() => {
	return fieldDetailStore.field.schema?.is_primary_key === true;
});

const isGenerated = computed(() => {
	return fieldDetailStore.field.schema?.is_generated;
});

function useOnCreate() {
	const onCreateSpecials = ['uuid', 'user-created', 'role-created', 'date-created'];

	const onCreateOptions = computed(() => {
		if (type.value === 'uuid') {
			const options = [
				{
					text: t('do_nothing'),
					value: null,
				},
				{
					text: t('generate_and_save_uuid'),
					value: 'uuid',
				},
				{
					text: t('save_current_user_id'),
					value: 'user-created',
				},
				{
					text: t('save_current_user_role'),
					value: 'role-created',
				},
			];

			if (localType.value === 'm2o' && relations.value.m2o?.related_collection === 'directus_users') {
				return options.filter(({ value }) => [null, 'user-created'].includes(value));
			}

			if (localType.value === 'm2o' && relations.value.m2o?.related_collection === 'directus_roles') {
				return options.filter(({ value }) => [null, 'role-created'].includes(value));
			}

			return options;
		} else if (['date', 'time', 'dateTime', 'timestamp'].includes(type.value!)) {
			return [
				{
					text: t('do_nothing'),
					value: null,
				},
				{
					text: t('save_current_datetime'),
					value: 'date-created',
				},
			];
		}

		return [];
	});

	const onCreateValue = computed({
		get() {
			const specials = special.value ?? [];

			for (const special of onCreateSpecials) {
				if (specials.includes(special)) {
					return special;
				}
			}

			return null;
		},
		set(newOption: string | null) {
			// In case of previously persisted empty string
			if (typeof special.value === 'string') {
				special.value = [];
			}

			special.value = (special.value ?? []).filter((special: string) => onCreateSpecials.includes(special) === false);

			if (newOption) {
				special.value = [...(special.value ?? []), newOption];
			}

			// Prevent empty array saved as empty string
			if (special.value && special.value.length === 0) {
				special.value = null;
			}
		},
	});

	return { onCreateSpecials, onCreateOptions, onCreateValue };
}

function useOnUpdate() {
	const onUpdateSpecials = ['user-updated', 'role-updated', 'date-updated'];

	const onUpdateOptions = computed(() => {
		if (type.value === 'uuid') {
			const options = [
				{
					text: t('do_nothing'),
					value: null,
				},
				{
					text: t('save_current_user_id'),
					value: 'user-updated',
				},
				{
					text: t('save_current_user_role'),
					value: 'role-updated',
				},
			];

			if (localType.value === 'm2o' && relations.value.m2o?.related_collection === 'directus_users') {
				return options.filter(({ value }) => [null, 'user-updated'].includes(value));
			}

			if (localType.value === 'm2o' && relations.value.m2o?.related_collection === 'directus_roles') {
				return options.filter(({ value }) => [null, 'role-updated'].includes(value));
			}

			return options;
		} else if (['date', 'time', 'dateTime', 'timestamp'].includes(type.value!)) {
			return [
				{
					text: t('do_nothing'),
					value: null,
				},
				{
					text: t('save_current_datetime'),
					value: 'date-updated',
				},
			];
		}

		return [];
	});

	const onUpdateValue = computed({
		get() {
			const specials = special.value ?? [];

			for (const special of onUpdateSpecials) {
				if (specials.includes(special)) {
					return special;
				}
			}

			return null;
		},
		set(newOption: string | null) {
			// In case of previously persisted empty string
			if (typeof special.value === 'string') {
				special.value = [];
			}

			special.value = (special.value ?? []).filter((special: string) => onUpdateSpecials.includes(special) === false);

			if (newOption) {
				special.value = [...(special.value ?? []), newOption];
			}

			// Prevent empty array saved as empty string
			if (special.value && special.value.length === 0) {
				special.value = null;
			}
		},
	});

	return { onUpdateSpecials, onUpdateOptions, onUpdateValue };
}

/** BoSelect items are strings: null and booleans travel as keys. */
const NULL_KEY = '$null';
const asKey = (value: unknown) => (value === null || value === undefined ? NULL_KEY : String(value));
const fromKey = (key: string) => (key === NULL_KEY ? null : key === 'true' ? true : key === 'false' ? false : key);
const keyed = (options: { text: string; value: unknown }[]) =>
	options.map((option) => ({ text: String(option.text), value: asKey(option.value) }));

const typeItems = computed(() =>
	(typesWithLabels.value.filter((item) => !('divider' in item)) as FieldTypeOption[]).map((item) => ({
		text: String(item.text),
		value: item.value,
	})),
);

const LABEL = 'mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<div class="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
		<div class="sm:col-span-2">
			<p :class="LABEL">
				{{ $t('key') }}
				<BoIcon name="star" size="sm" class="text-error-500" :label="$t('required')" />
			</p>

			<BoInput
				v-model="field"
				:disabled="isExisting"
				autofocus
				class="font-mono"
				db-safe
				:aria-label="$t('key')"
				:placeholder="$t('a_unique_column_name')"
			/>

			<small class="mt-1 block max-w-[29.25rem] text-theme-xs text-gray-500 dark:text-gray-400">
				{{ $t('schema_setup_key') }}
			</small>
		</div>

		<div>
			<p :class="LABEL">
				{{ $t('type') }}
				<BoIcon name="star" size="sm" class="text-error-500" :label="$t('required')" />
			</p>
			<BoInput v-if="isAlias" :model-value="$t('alias')" :aria-label="$t('type')" disabled />
			<BoSelect
				v-else
				v-model="type"
				:disabled="typeDisabled || isExisting"
				:items="typeItems"
				:placeholder="typePlaceholder"
			/>
		</div>

		<template v-if="['decimal', 'float'].includes(type) === false">
			<div v-if="!isAlias">
				<p :class="LABEL">{{ $t('length') }}</p>
				<BoInput
					v-model="maxLength"
					type="number"
					:aria-label="$t('length')"
					:placeholder="type !== 'string' ? $t('not_available_for_type') : '255'"
					:disabled="isExisting || type !== 'string'"
				/>
			</div>
		</template>

		<template v-else>
			<div v-if="!isAlias">
				<p :class="LABEL">{{ $t('precision_scale') }}</p>
				<div class="grid grid-cols-2 gap-2">
					<BoInput v-model="numericPrecision" type="number" :aria-label="$t('precision_scale')" placeholder="10" />
					<BoInput v-model="numericScale" type="number" :aria-label="$t('precision_scale')" placeholder="5" />
				</div>
			</div>
		</template>

		<template v-if="hasCreateUpdateTriggers">
			<BoSelect
				:label="$t('on_create')"
				:model-value="asKey(onCreateValue)"
				:items="keyed(onCreateOptions)"
				@update:model-value="onCreateValue = fromKey($event) as never"
			/>

			<BoSelect
				:label="$t('on_update')"
				:model-value="asKey(onUpdateValue)"
				:items="keyed(onUpdateOptions)"
				@update:model-value="onUpdateValue = fromKey($event) as never"
			/>
		</template>

		<div v-if="!isAlias && !isPrimaryKey && !isGenerated" class="sm:col-span-2">
			<p :class="LABEL">{{ $t('default_value') }}</p>

			<BoInput
				v-if="['string', 'uuid'].includes(type)"
				v-model="defaultValue"
				class="font-mono"
				:aria-label="$t('default_value')"
				placeholder="NULL"
			/>

			<BoTextarea
				v-else-if="['text'].includes(type)"
				v-model="defaultValue"
				class="font-mono"
				:aria-label="$t('default_value')"
				placeholder="NULL"
			/>
			<BoInput
				v-else-if="['integer', 'bigInteger', 'float', 'decimal'].includes(type)"
				v-model="defaultValue"
				type="number"
				class="font-mono"
				:aria-label="$t('default_value')"
				placeholder="NULL"
			/>
			<BoInput
				v-else-if="['timestamp', 'dateTime', 'date', 'time'].includes(type)"
				v-model="defaultValue"
				class="font-mono"
				:aria-label="$t('default_value')"
				placeholder="NULL"
			/>
			<BoSelect
				v-else-if="type === 'boolean'"
				class="font-mono"
				:model-value="asKey(defaultValue)"
				:items="[
					{ text: 'true', value: 'true' },
					{ text: 'false', value: 'false' },
					{ text: 'NULL', value: NULL_KEY },
				]"
				@update:model-value="defaultValue = fromKey($event)"
			/>
			<InterfaceInputCode
				v-else-if="type === 'json'"
				:value="defaultValue"
				language="JSON"
				placeholder="NULL"
				type="json"
				@input="defaultValue = $event"
			/>
			<BoInput
				v-else
				v-model="defaultValue"
				class="font-mono"
				:aria-label="$t('default_value')"
				disabled
				placeholder="NULL"
			/>
		</div>

		<div v-if="!isAlias">
			<p :class="LABEL">{{ $t('nullable') }}</p>
			<BoCheckbox v-model="nullable" :disabled="!!(isGenerated || isPrimaryKey)" :label="$t('allow_null_value')" />
		</div>

		<div v-if="!isAlias">
			<p :class="LABEL">{{ $t('unique') }}</p>
			<BoCheckbox v-model="unique" :disabled="!!(isGenerated || isPrimaryKey)" :label="$t('value_unique')" />
		</div>

		<div v-if="!isAlias">
			<p :class="LABEL">{{ $t('index') }}</p>
			<BoCheckbox v-model="indexed" :disabled="!!(isGenerated || isPrimaryKey)" :label="$t('value_index')" />
		</div>
	</div>
</template>
