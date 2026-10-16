<!-- Ported from directus/app/src/interfaces/_system/system-display-template/system-display-template.vue -->
<script setup lang="ts">
// Backoffice: v-field-template (a chip editor) is a BoInput with a field picker button, as the layout options of 014
// (CardsOptions.vue): FieldList in a popover appends `{{ field }}` to the template (Directus inserts at the caret).
// With versioning on and `injectVersionField`, a "version" row adds `{{ $version }}` (Directus injects the fake field
// in the tree).
// shortcut: a `fields` prop (a custom tree, no yaml caller in Directus 11.17.4) lists its top-level keys only; build a
// tree picker on FieldNode when a caller needs nested keys.
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, inject, ref } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoNotice from '../../../components/BoNotice.vue';
import FieldList from '../../../components/FieldList.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { useFakeVersionField } from '../../../composables/use-fake-version-field.ts';
import type { FieldNode } from '../../../composables/use-field-tree.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';

const props = withDefaults(
	defineProps<{
		value: string | null;
		placeholder?: string | null;
		disabled?: boolean;
		collectionField?: string;
		collectionName?: string;
		fields?: FieldNode[];
		injectVersionField?: boolean;
		includeRelations?: boolean;
	}>(),
	{
		includeRelations: true,
	},
);

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const a11y = inject(FORM_FIELD_A11Y, null);
const collectionsStore = useCollectionsStore();

const values = inject('values', ref<Record<string, any>>({}));

const collection = computed(() => {
	if (!props.collectionField) {
		if (props.collectionName) return props.collectionName;
		return null;
	}

	const collectionName = values.value[props.collectionField];

	const collectionExists = !!collectionsStore.collections.find(
		(collection) => collection.collection === collectionName,
	);

	if (collectionExists === false) return null;
	return collectionName;
});

const versioningEnabled = computed(() => Boolean(values.value['versioning'] && props.injectVersionField));
const { fakeVersionField } = useFakeVersionField(collection, versioningEnabled);

const hidden = computed(() => !props.fields && collection.value === null);

function addField(key: string) {
	emit('input', `${props.value ?? ''}{{ ${key} }}`);
}

const ICON_BTN =
	'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
const ROW =
	'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="system-display-template">
		<BoNotice v-if="hidden">
			{{ $t('interfaces.system-display-template.select_a_collection') }}
		</BoNotice>
		<div v-else class="flex items-center gap-2">
			<div class="min-w-0 flex-1">
				<BoInput
					v-bind="{ ...(a11y?.inputId ? { id: a11y.inputId } : {}), ...(placeholder ? { placeholder } : {}) }"
					class="font-mono"
					:model-value="value ?? ''"
					:disabled="!!disabled"
					@update:model-value="emit('input', $event || null)"
				/>
			</div>
			<PopoverRoot>
				<PopoverTrigger :class="ICON_BTN" :disabled="disabled" :aria-label="$t('add_field')" :title="$t('add_field')">
					<BoIcon name="add" size="sm" />
				</PopoverTrigger>
				<PopoverPortal>
					<PopoverContent :side-offset="4" align="end" :collision-padding="8" :class="POPOVER">
						<template v-if="fields">
							<button v-for="node in fields" :key="node.key" type="button" :class="ROW" @click="addField(node.key)">
								{{ node.name }}
							</button>
						</template>
						<template v-else>
							<button v-if="fakeVersionField" type="button" :class="ROW" @click="addField(fakeVersionField.field)">
								{{ fakeVersionField.name }}
							</button>
							<FieldList
								:collection="collection!"
								:include-relations="includeRelations"
								:allow-select-all="false"
								@add="addField($event[0]!)"
							/>
						</template>
					</PopoverContent>
				</PopoverPortal>
			</PopoverRoot>
		</div>
	</div>
</template>
