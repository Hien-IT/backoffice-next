<!-- Ported from directus/app/src/interfaces/_system/system-fields/system-fields.vue -->
<script setup lang="ts">
// Backoffice: the Draggable VList is BoSortableList (drag handle and the D-96 Move up / Move down menu, which emit the
// same reordered list), the remove `close` icon is a row action; VMenu + VFieldList is a popover with FieldList (as
// the layout options of 014). DR calls `t` without importing it for function fields; useI18n provides it here.
import type { Field } from '@directus/types';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import BoNotice from '../../../components/BoNotice.vue';
import BoSortableList from '../../../components/BoSortableList.vue';
import FieldList from '../../../components/FieldList.vue';
import { extractFieldFromFunction } from '../../../components/form/utils/extract-field-from-function.ts';
import { useFieldsStore } from '../../../stores/fields.ts';

interface Props {
	collectionName: string;
	value?: string[] | null;
	allowSelectAll?: boolean;
	fieldFilter?: ((field: Field) => boolean) | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	value: null,
	allowSelectAll: false,
	fieldFilter: undefined,
});

const emit = defineEmits(['input']);

const { t } = useI18n();
const fieldsStore = useFieldsStore();

type Row = Field & { key: string; displayName: string };

const fields = computed<Row[]>({
	get() {
		return (
			props.value?.map((fieldKey) => ({
				key: fieldKey,
				...fieldsStore.getField(props.collectionName, fieldKey)!,
				displayName: getFieldDisplayName(fieldKey),
			})) ?? []
		);

		function getFieldDisplayName(fieldKey: string) {
			const fieldParts = fieldKey.split('.');

			const fieldNames = fieldParts.map((fieldKey, index) => {
				const hasFunction = fieldKey.includes('(') && fieldKey.includes(')');

				let key = fieldKey;
				let functionName;

				if (hasFunction) {
					const { field, fn } = extractFieldFromFunction(fieldKey);
					functionName = fn;
					key = field;
				}

				const pathPrefix = fieldParts.slice(0, index);
				const field = fieldsStore.getField(props.collectionName, [...pathPrefix, key].join('.'));

				const name = field?.name ?? key;

				if (hasFunction) {
					return t(`functions.${functionName}`) + ` (${name})`;
				}

				return name;
			});

			return fieldNames.join(' -> ');
		}
	},
	set(updatedFields) {
		const newFields = updatedFields.map((field) => field.key);
		emit('input', newFields);
	},
});

const addFields = (fields: string[]) => {
	const uniqueFields = new Set([...(props.value ?? []), ...fields]);
	emit('input', Array.from(uniqueFields));
};

const removeField = (field: string) => {
	const newFields = props.value?.filter((val) => val !== field);

	if (!newFields || newFields.length === 0) {
		emit('input', null);
	}

	emit('input', newFields);
};

const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<template v-if="!collectionName">
		<BoNotice>
			{{ $t('interfaces.system-fields.select_a_collection') }}
		</BoNotice>
	</template>
	<template v-else>
		<BoNotice v-if="fields.length === 0" type="normal">{{ $t('interfaces.system-fields.no_fields') }}</BoNotice>
		<BoSortableList
			v-else
			v-model="fields"
			item-key="key"
			:item-label="(row: Row) => row.displayName"
			:row-actions="(row: Row) => [{ text: $t('remove'), icon: 'close', onSelect: () => removeField(row.key) }]"
		>
			<template #item="{ element }">
				<span class="text-theme-sm text-gray-800 dark:text-white/90">{{ element.displayName }}</span>
			</template>
		</BoSortableList>

		<PopoverRoot>
			<PopoverTrigger
				class="mt-2 inline-flex items-center gap-1 rounded px-1 text-theme-sm font-semibold text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:focus-visible:outline-brand-400"
			>
				{{ $t('add_field') }}
				<BoIcon name="expand_more" size="sm" />
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent :side-offset="4" align="start" :collision-padding="8" :class="POPOVER">
					<FieldList
						:disabled-fields="value ?? []"
						:collection="collectionName"
						:allow-select-all="allowSelectAll"
						:field-filter="fieldFilter"
						@add="addFields"
					/>
				</PopoverContent>
			</PopoverPortal>
		</PopoverRoot>
	</template>
</template>
