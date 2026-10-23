<!-- Ported from directus/app/src/layouts/kanban/options.vue -->
<script setup lang="ts">
// Backoffice: BoSelect with its label instead of `.type-label` + v-select; `show-deselect` is a "Deselect" first item
// (emitted as null; Reka Select items cannot have an empty value); BoCheckbox with the `.type-label` text as its group label; v-detail -> BoDetail; the
// advanced options stack in one column (the options sidebar is too narrow for the DR two-column grid);
// `useSync` = emit of the update.
import { useI18n } from 'vue-i18n';
import BoCheckbox from '../../components/BoCheckbox.vue';
import BoDetail from '../../components/BoDetail.vue';
import BoSelect from '../../components/BoSelect.vue';

defineOptions({ inheritAttrs: false });

withDefaults(
	defineProps<{
		collection: string;
		fieldGroups: Record<string, Record<string, any>[]>;
		groupTitleFields?: Record<string, any>[] | null;
		groupField?: string | null;
		groupTitle?: string | null;
		isRelational?: boolean;
		imageSource?: string | null;
		titleField?: string | null;
		textField?: string | null;
		crop: boolean;
		dateField?: string | null;
		tagsField?: string | null;
		userField?: string | null;
		showUngrouped?: boolean;
		ungroupedDisabled: boolean;
	}>(),
	{
		groupTitleFields: () => [],
		groupField: null,
		groupTitle: null,
		isRelational: true,
		imageSource: null,
		titleField: null,
		textField: null,
		dateField: null,
		tagsField: null,
		userField: null,
		showUngrouped: true,
	},
);

const emit = defineEmits<{
	'update:imageSource': [value: string | null];
	'update:titleField': [value: string | null];
	'update:crop': [value: boolean];
	'update:textField': [value: string | null];
	'update:groupField': [value: string | null];
	'update:groupTitle': [value: string | null];
	'update:dateField': [value: string | null];
	'update:tagsField': [value: string | null];
	'update:userField': [value: string | null];
	'update:showUngrouped': [value: boolean];
}>();

const { t } = useI18n();

type FieldOption =
	| 'imageSource'
	| 'titleField'
	| 'textField'
	| 'groupField'
	| 'groupTitle'
	| 'dateField'
	| 'tagsField'
	| 'userField';

function itemsOf(fields: Record<string, any>[] | null | undefined, deselect: boolean) {
	const items = (fields ?? []).map((field) => ({ text: field['name'] as string, value: field['field'] as string }));
	return deselect ? [{ text: t('deselect'), value: DESELECT, icon: 'close' }, ...items] : items;
}

function update(key: FieldOption, value: string) {
	(emit as (event: string, value: string | null) => void)(`update:${key}`, value === DESELECT ? null : value);
}

const DESELECT = '$deselect';
const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
</script>

<template>
	<div class="space-y-4">
		<BoSelect
			:label="$t('layouts.kanban.group_field')"
			:model-value="groupField"
			:items="itemsOf(fieldGroups['group'], false)"
			:placeholder="$t('layouts.kanban.group_field_placeholder')"
			@update:model-value="update('groupField', $event)"
		/>

		<BoSelect
			v-if="groupField && isRelational"
			:label="$t('layouts.kanban.group_title')"
			:model-value="groupTitle"
			:items="itemsOf(groupTitleFields, false)"
			:placeholder="$t('layouts.kanban.group_title_placeholder')"
			@update:model-value="update('groupTitle', $event)"
		/>

		<BoSelect
			:label="$t('layouts.kanban.title')"
			:model-value="titleField"
			:items="itemsOf(fieldGroups['title'], !!titleField)"
			:placeholder="$t('layouts.kanban.title_placeholder')"
			@update:model-value="update('titleField', $event)"
		/>

		<BoSelect
			:label="$t('layouts.kanban.text')"
			:model-value="textField"
			:items="itemsOf(fieldGroups['text'], !!textField)"
			:placeholder="$t('layouts.kanban.text_placeholder')"
			@update:model-value="update('textField', $event)"
		/>

		<BoDetail :title="$t('layouts.kanban.advanced')">
			<div class="space-y-4 pt-4">
				<BoSelect
					:label="$t('layouts.kanban.tags')"
					:model-value="tagsField"
					:items="itemsOf(fieldGroups['tags'], !!tagsField)"
					:placeholder="$t('layouts.kanban.tags_placeholder')"
					@update:model-value="update('tagsField', $event)"
				/>

				<BoSelect
					:label="$t('layouts.kanban.date')"
					:model-value="dateField"
					:items="itemsOf(fieldGroups['date'], !!dateField)"
					:placeholder="$t('layouts.kanban.date_placeholder')"
					@update:model-value="update('dateField', $event)"
				/>

				<BoSelect
					:label="$t('layouts.kanban.image')"
					:model-value="imageSource"
					:items="itemsOf(fieldGroups['file'], !!imageSource)"
					:placeholder="$t('layouts.kanban.image_placeholder')"
					@update:model-value="update('imageSource', $event)"
				/>

				<fieldset>
					<legend :class="LABEL">{{ $t('layouts.kanban.image_fit') }}</legend>
					<BoCheckbox
						:model-value="crop"
						:label="$t('layouts.kanban.crop')"
						@update:model-value="emit('update:crop', !!$event)"
					/>
				</fieldset>

				<BoSelect
					:label="$t('layouts.kanban.user')"
					:model-value="userField"
					:items="itemsOf(fieldGroups['user'], !!userField)"
					:placeholder="$t('layouts.kanban.user_placeholder')"
					@update:model-value="update('userField', $event)"
				/>

				<fieldset>
					<legend :class="LABEL">{{ $t('layouts.kanban.show_ungrouped') }}</legend>
					<BoCheckbox
						:model-value="showUngrouped"
						:disabled="ungroupedDisabled"
						:label="$t('layouts.kanban.show')"
						@update:model-value="emit('update:showUngrouped', !!$event)"
					/>
				</fieldset>
			</div>
		</BoDetail>
	</div>
</template>
