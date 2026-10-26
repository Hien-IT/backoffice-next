<script setup lang="ts">
// Backoffice (spec 023, D-187): step 2 of the filter popover for a json field (owner as design owner 2026-10-27: the
// Q-7 popover with the Input and Select recipes of component-specs.md). Apply only emits a valid path (FR-014): no request is sent for a wrong one.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoSelect from '../../../components/BoSelect.vue';
import { isValidJsonPath, JSON_PATH_TYPES, type JsonPathType } from '../../../utils/json-path.ts';

const props = withDefaults(
	defineProps<{
		/** Display name of the json field (with its relational prefix). */
		title: string;
		path?: string;
		type?: JsonPathType;
		/** Show the link back to the field list (adding a rule). */
		back?: boolean;
	}>(),
	{ path: '', type: 'text', back: false },
);

const emit = defineEmits<{ apply: [value: { path: string; type: JsonPathType }]; back: [] }>();

const { t } = useI18n();
const path = ref(props.path);
const type = ref<string>(props.type);
const touched = ref(false);

const invalid = computed(() => touched.value && !isValidJsonPath(path.value));

const typeItems = computed(() => JSON_PATH_TYPES.map((value) => ({ value, text: t(`json_path_type_${value}`) })));

function apply() {
	touched.value = true;
	if (!isValidJsonPath(path.value)) return;
	emit('apply', { path: path.value.trim(), type: type.value as JsonPathType });
}
</script>

<template>
	<form class="json-path-form flex flex-col gap-3" novalidate @submit.prevent="apply">
		<div class="flex items-center gap-1">
			<button
				v-if="back"
				type="button"
				class="json-path-back inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
				:aria-label="t('back')"
				:title="t('back')"
				@click="emit('back')"
			>
				<BoIcon name="arrow_back" size="sm" />
			</button>
			<span class="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
				{{ `${t('json_path')} (${title})` }}
			</span>
		</div>
		<BoInput
			v-model="path"
			class="json-path-input"
			:label="t('json_path')"
			placeholder="Amount, items[*].sku"
			autofocus
			:invalid="invalid"
			v-bind="invalid ? { error: t('json_path_invalid') } : {}"
			@blur="touched = true"
		/>
		<BoSelect v-model="type" class="json-path-type" :label="t('type')" :items="typeItems" />
		<div class="flex justify-end">
			<BoButton type="submit" size="sm" class="json-path-apply">{{ t('json_path_apply') }}</BoButton>
		</div>
	</form>
</template>
