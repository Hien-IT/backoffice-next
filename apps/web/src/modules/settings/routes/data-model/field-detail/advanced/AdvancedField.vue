<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-field.vue -->
<script setup lang="ts">
// Backoffice: VCheckbox is BoCheckbox, VNotice BoNotice, VSkeletonLoader a pulsing block; the list interface comes
// through the registry (import cycle, as CollectionDialog.vue). SEARCHABLE_TYPES of @directus/constants inlined.
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { syncFieldDetailStoreProperty, useFieldDetailStore } from '../store/index.ts';
import { useUserStore } from '../../../../../../stores/user.ts';
import BoCheckbox from '../../../../../../components/BoCheckbox.vue';
import BoNotice from '../../../../../../components/BoNotice.vue';
import { getInterface } from '../../../../../../interfaces/index.ts';
import InterfaceSystemInputTranslatedString from '../../../../../../interfaces/_system/system-input-translated-string/InputTranslatedString.vue';

const SEARCHABLE_TYPES: string[] = ['text', 'string', 'integer', 'bigInteger', 'float', 'decimal', 'uuid'];
const InterfaceList = getInterface('list')!.component;

const fieldDetailStore = useFieldDetailStore();
const readonly = syncFieldDetailStoreProperty('field.meta.readonly', false);
const hidden = syncFieldDetailStoreProperty('field.meta.hidden', false);
const required = syncFieldDetailStoreProperty('field.meta.required', false);
const note = syncFieldDetailStoreProperty('field.meta.note');
const translations = syncFieldDetailStoreProperty('field.meta.translations');
const { loading, field, localType } = storeToRefs(fieldDetailStore);
const type = computed(() => field.value.type);
const isGenerated = computed(() => field.value.schema?.is_generated);
const userStore = useUserStore();
const searchable = syncFieldDetailStoreProperty('field.meta.searchable', true);

const isSearchableType = computed(() => {
	// exclude alias fields (o2m, m2m, m2a) as they don't store searchable data
	if (type.value === 'alias') return false;

	// exclude relational fields except m2o, which stores foreign keys that are typically not useful for search
	if (localType.value && localType.value !== 'standard') return false;

	return SEARCHABLE_TYPES.includes(type.value ?? '');
});
const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<div class="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
		<div v-if="!isGenerated">
			<p :class="LABEL">{{ $t('readonly') }}</p>
			<BoCheckbox v-model="readonly" :label="$t('readonly_field_label')" />
		</div>

		<div v-if="!isGenerated">
			<p :class="LABEL">{{ $t('required') }}</p>
			<BoCheckbox v-model="required" :label="$t('require_value_to_be_set')" />
		</div>

		<BoNotice v-if="readonly && required" type="warning" class="sm:col-span-2">
			{{ $t('required_readonly_field_warning') }}
		</BoNotice>

		<div>
			<p :class="LABEL">{{ $t('hidden') }}</p>
			<BoCheckbox v-model="hidden" :label="$t('hidden_on_detail')" />
		</div>

		<div v-if="isSearchableType">
			<p :class="LABEL">{{ $t('searchable') }}</p>
			<BoCheckbox v-model="searchable" :label="$t('field_searchable')" />
		</div>

		<div v-if="(type as string) !== 'group'" class="sm:col-span-2">
			<p :class="LABEL">{{ $t('note') }}</p>
			<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
			<InterfaceSystemInputTranslatedString v-else :value="note" :placeholder="$t('add_note')" @input="note = $event" />
		</div>

		<div class="sm:col-span-2">
			<p :class="LABEL">{{ $t('field_name_translations') }}</p>

			<InterfaceList
				:template="'[{{ language }}] {{ translation }}'"
				:fields="[
					{
						field: 'language',
						type: 'string',
						name: $t('language'),
						meta: {
							interface: 'system-language',
							width: 'full',
							required: true,
							display: 'formatted-value',
							display_options: {
								font: 'monospace',
								color: 'var(--theme--foreground-subdued)',
							},
						},
						schema: {
							default_value: userStore.language,
						},
					},
					{
						field: 'translation',
						type: 'string',
						name: $t('translation'),
						meta: {
							interface: 'input-multiline',
							width: 'full',
							required: true,
							options: {
								placeholder: $t('translation_placeholder'),
							},
						},
					},
				]"
				:value="translations"
				@input="translations = $event"
			/>
		</div>
	</div>
</template>
