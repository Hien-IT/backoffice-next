<!-- Ported from directus/app/src/modules/settings/routes/data-model/new-collection.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US1-7, US1-8, FR-015, recipe Q-27): BoDrawer with horizontal BoTabs over the form instead of
// v-drawer tabs in its sidebar (two steps; a vertical list leaves the 640px drawer too narrow); the payloads, the relations of user_created/user_updated, the store
// hydrations and the notice are the Directus ones. Enter in a step goes to the next step or saves (Directus `apply`).
// The choice colors of `status` are Directus theme variables stored as data (the Directus app reads them).
import type { DeepPartial, Field, Relation } from '@directus/types';
import { cloneDeep } from 'lodash-es';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoCheckbox from '../../../../components/BoCheckbox.vue';
import BoIcon from '../../../../components/BoIcon.vue';
import BoInput from '../../../../components/BoInput.vue';
import BoNotice from '../../../../components/BoNotice.vue';
import BoSelect from '../../../../components/BoSelect.vue';
import BoTabs from '../../../../components/BoTabs.vue';
import BoDrawer from '../../../../components/drawers/BoDrawer.vue';
import { useDialogRoute } from '../../../../composables/use-dialog-route.ts';
import { notify, showUnexpectedError } from '../../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';

const defaultSystemFields = {
	status: { enabled: false, inputDisabled: false, name: 'status', label: 'status', icon: 'flag' },
	sort: { enabled: false, inputDisabled: false, name: 'sort', label: 'sort', icon: 'low_priority' },
	dateCreated: { enabled: false, inputDisabled: false, name: 'date_created', label: 'created_on', icon: 'access_time' },
	userCreated: { enabled: false, inputDisabled: false, name: 'user_created', label: 'created_by', icon: 'account_circle' },
	dateUpdated: { enabled: false, inputDisabled: false, name: 'date_updated', label: 'updated_on', icon: 'access_time' },
	userUpdated: { enabled: false, inputDisabled: false, name: 'user_updated', label: 'updated_by', icon: 'account_circle' },
};

const { t } = useI18n();
const router = useRouter();
const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const isOpen = useDialogRoute();

const currentTab = ref('collection_setup');

const collectionName = ref<string | null>(null);
const singleton = ref(false);
const primaryKeyFieldName = ref('id');
const primaryKeyFieldType = ref<'auto_int' | 'auto_big_int' | 'uuid' | 'manual'>('auto_int');

const sortField = ref<string>();
const archiveField = ref<string>();
const archiveValue = ref<string>();
const unarchiveValue = ref<string>();

const systemFields = reactive(cloneDeep(defaultSystemFields));

const saving = ref(false);

watch(() => singleton.value, setOptionsForSingleton);

function setOptionsForSingleton() {
	systemFields.sort = { ...defaultSystemFields.sort };
	systemFields.sort.inputDisabled = singleton.value;
}

const tabs = computed(() => [
	{ value: 'collection_setup', label: t('collection_setup') },
	{ value: 'optional_system_fields', label: t('optional_system_fields'), disabled: !collectionName.value },
]);

const primaryKeyTypes = computed(() => [
	{ text: t('auto_increment_integer'), value: 'auto_int' },
	{ text: t('auto_increment_big_integer'), value: 'auto_big_int' },
	{ text: t('generated_uuid'), value: 'uuid' },
	{ text: t('manual_string'), value: 'manual' },
]);

async function save() {
	saving.value = true;

	try {
		const created = await sdk.request(
			requestEndpoint<{ collection: string }>('/collections', {
				method: 'POST',
				body: {
					collection: collectionName.value,
					fields: [getPrimaryKeyField(), ...getSystemFields()],
					schema: {},
					meta: {
						sort_field: sortField.value,
						archive_field: archiveField.value,
						archive_value: archiveValue.value,
						unarchive_value: unarchiveValue.value,
						singleton: singleton.value,
					},
				},
			}),
		);

		const storeHydrations: Promise<void>[] = [];
		const relations = getSystemRelations();

		if (relations.length > 0) {
			await Promise.all(
				relations.map((relation) => sdk.request(requestEndpoint('/relations', { method: 'POST', body: relation }))),
			);
			storeHydrations.push(relationsStore.hydrate());
		}

		storeHydrations.push(collectionsStore.hydrate(), fieldsStore.hydrate());
		await Promise.all(storeHydrations);

		notify({ title: t('collection_created'), type: 'success' });

		router.replace({ name: 'settings-fields', params: { collection: created.collection } });
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}

function getPrimaryKeyField() {
	if (primaryKeyFieldType.value === 'uuid') {
		return {
			field: primaryKeyFieldName.value,
			type: 'uuid',
			meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
			schema: { is_primary_key: true, length: 36, has_auto_increment: false },
		};
	} else if (primaryKeyFieldType.value === 'manual') {
		return {
			field: primaryKeyFieldName.value,
			type: 'string',
			meta: { interface: 'input', readonly: false, hidden: false },
			schema: { is_primary_key: true, length: 255, has_auto_increment: false },
		};
	} else {
		return {
			field: primaryKeyFieldName.value,
			type: primaryKeyFieldType.value === 'auto_big_int' ? 'bigInteger' : 'integer',
			meta: { hidden: true, interface: 'input', readonly: true },
			schema: { is_primary_key: true, has_auto_increment: true },
		};
	}
}

function getSystemFields() {
	const fields: DeepPartial<Field>[] = [];

	// Status
	if (systemFields.status.enabled === true) {
		fields.push({
			field: systemFields.status.name,
			type: 'string',
			meta: {
				width: 'full',
				options: {
					choices: [
						{ text: '$t:published', value: 'published', color: 'var(--theme--primary)' },
						{ text: '$t:draft', value: 'draft', color: 'var(--theme--foreground)' },
						{ text: '$t:archived', value: 'archived', color: 'var(--theme--warning)' },
					],
				},
				interface: 'select-dropdown',
				display: 'labels',
				display_options: {
					showAsDot: true,
					choices: [
						{
							text: '$t:published',
							value: 'published',
							color: 'var(--theme--primary)',
							foreground: 'var(--theme--primary)',
							background: 'var(--theme--primary-background)',
						},
						{
							text: '$t:draft',
							value: 'draft',
							color: 'var(--theme--foreground)',
							foreground: 'var(--theme--foreground)',
							background: 'var(--theme--background-normal)',
						},
						{
							text: '$t:archived',
							value: 'archived',
							color: 'var(--theme--warning)',
							foreground: 'var(--theme--warning)',
							background: 'var(--theme--warning-background)',
						},
					],
				},
			},
			schema: { default_value: 'draft', is_nullable: false },
		});

		archiveField.value = systemFields.status.name;
		archiveValue.value = 'archived';
		unarchiveValue.value = 'draft';
	}

	// Sort
	if (systemFields.sort.enabled === true) {
		fields.push({
			field: systemFields.sort.name,
			type: 'integer',
			meta: { interface: 'input', hidden: true },
			schema: {},
		});

		sortField.value = systemFields.sort.name;
	}

	if (systemFields.userCreated.enabled === true) {
		fields.push({
			field: systemFields.userCreated.name,
			type: 'uuid',
			meta: {
				special: ['user-created'],
				interface: 'select-dropdown-m2o',
				options: { template: '{{avatar}} {{first_name}} {{last_name}}' },
				display: 'user',
				readonly: true,
				hidden: true,
				width: 'half',
			},
			schema: {},
		});
	}

	if (systemFields.dateCreated.enabled === true) {
		fields.push({
			field: systemFields.dateCreated.name,
			type: 'timestamp',
			meta: {
				special: ['date-created'],
				interface: 'datetime',
				readonly: true,
				hidden: true,
				width: 'half',
				display: 'datetime',
				display_options: { relative: true },
			},
			schema: {},
		});
	}

	if (systemFields.userUpdated.enabled === true) {
		fields.push({
			field: systemFields.userUpdated.name,
			type: 'uuid',
			meta: {
				special: ['user-updated'],
				interface: 'select-dropdown-m2o',
				options: { template: '{{avatar}} {{first_name}} {{last_name}}' },
				display: 'user',
				readonly: true,
				hidden: true,
				width: 'half',
			},
			schema: {},
		});
	}

	if (systemFields.dateUpdated.enabled === true) {
		fields.push({
			field: systemFields.dateUpdated.name,
			type: 'timestamp',
			meta: {
				special: ['date-updated'],
				interface: 'datetime',
				readonly: true,
				hidden: true,
				width: 'half',
				display: 'datetime',
				display_options: { relative: true },
			},
			schema: {},
		});
	}

	return fields;
}

function getSystemRelations() {
	const relations: Partial<Relation>[] = [];

	if (systemFields.userCreated.enabled === true) {
		relations.push({
			collection: collectionName.value!,
			field: systemFields.userCreated.name,
			related_collection: 'directus_users',
			schema: {} as never,
		});
	}

	if (systemFields.userUpdated.enabled === true) {
		relations.push({
			collection: collectionName.value!,
			field: systemFields.userUpdated.name,
			related_collection: 'directus_users',
			schema: {} as never,
		});
	}

	return relations;
}

function onApply() {
	if (currentTab.value === 'optional_system_fields') {
		if (saving.value) return;
		save();
		return;
	}

	if (!collectionName.value?.length) return;

	currentTab.value = 'optional_system_fields';
}

function cancel() {
	router.push({ name: 'settings-collections' });
}

const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400';
</script>

<template>
	<BoDrawer
		v-model="isOpen"
		:title="$t('creating_new_collection')"
		icon="box"
		persistent
		@cancel="cancel"
		@update:model-value="!$event && cancel()"
	>
		<template #actions>
			<BoButton
				v-if="currentTab === 'collection_setup'"
				icon="arrow_forward"
				:aria-label="$t('next')"
				:title="$t('next')"
				:disabled="!collectionName || collectionName.length === 0"
				@click="currentTab = 'optional_system_fields'"
			/>
			<BoButton
				v-else
				icon="check"
				:aria-label="$t('finish_setup')"
				:title="$t('finish_setup')"
				:loading="saving"
				@click="save"
			/>
		</template>

		<form class="p-6" @submit.prevent="onApply">
			<BoTabs v-model="currentTab" :items="tabs" :label="$t('creating_new_collection')">
				<template #content="{ item }">
					<div v-if="item.value === 'collection_setup'" class="flex flex-col gap-5">
						<BoNotice type="info">{{ $t('creating_collection_info') }}</BoNotice>

						<div class="grid grid-cols-2 gap-5">
							<div>
								<label :for="'new-collection-name'" :class="LABEL">
									{{ $t('name') }}
									<span class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
									<span class="sr-only">({{ $t('required') }})</span>
								</label>
								<BoInput
									id="new-collection-name"
									v-model="collectionName"
									class="font-mono"
									:placeholder="$t('a_unique_table_name')"
									aria-describedby="new-collection-name-note"
									db-safe
									autofocus
								/>
								<p id="new-collection-name-note" class="m-0 mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
									{{ $t('collection_names_are_case_sensitive') }}
								</p>
							</div>
							<div>
								<p :class="LABEL">{{ $t('singleton') }}</p>
								<BoCheckbox v-model="singleton" :label="$t('singleton_label')" />
							</div>
						</div>

						<hr class="m-0 border-gray-200 dark:border-gray-800" />

						<div class="grid grid-cols-2 gap-5">
							<BoInput
								v-model="primaryKeyFieldName"
								class="font-mono"
								:label="$t('primary_key_field')"
								:placeholder="$t('a_unique_column_name')"
								db-safe
							/>
							<BoSelect v-model="primaryKeyFieldType" :label="$t('type')" :items="primaryKeyTypes" />
						</div>
					</div>

					<div v-else class="flex flex-col gap-5">
						<BoNotice type="info">{{ $t('creating_collection_system') }}</BoNotice>

						<div class="grid grid-cols-2 gap-5">
							<div v-for="(info, key) in systemFields" :key="key">
								<label :for="`new-collection-${key}`" :class="LABEL">{{ $t(info.label) }}</label>
								<div class="flex items-center gap-3">
									<BoCheckbox
										v-model="info.enabled"
										:disabled="info.inputDisabled"
										:aria-label="$t(info.label)"
									/>
									<BoInput
										:id="`new-collection-${key}`"
										v-model="info.name"
										class="min-w-0 flex-1 font-mono"
										:placeholder="info.name"
										:disabled="info.inputDisabled"
										db-safe
										@focus="info.enabled = true"
									/>
									<BoIcon :name="info.icon" class="text-gray-500 dark:text-gray-400" />
								</div>
							</div>
						</div>
					</div>
				</template>
			</BoTabs>
			<button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
		</form>
	</BoDrawer>
</template>
