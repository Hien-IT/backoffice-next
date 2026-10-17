<script setup lang="ts">
import { TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText, TagsInputRoot } from 'reka-ui';
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';

// Raw tags only: the tags interface applies its Directus rules (trim, case, whitespace, alphabetize) on update.
const {
	modelValue = null,
	presets = [],
	disabled = false,
	invalid = false,
	error,
	hint,
	id: idProp,
	ariaDescribedby,
} = defineProps<{
	modelValue?: string[] | null;
	/** Suggested tags shown as toggle chips (Directus tags `presets`). */
	presets?: string[];
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	hint?: string;
	error?: string;
	id?: string | undefined;
	/** Form linking on the input (FormField ids), merged with the hint and error ids. */
	ariaLabelledby?: string | undefined;
	ariaDescribedby?: string | undefined;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const { t } = useI18n();

const id = idProp ?? useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const describedBy = computed(
	() => [ariaDescribedby, hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
);

function togglePreset(preset: string) {
	const value = modelValue ?? [];
	emit('update:modelValue', value.includes(preset) ? value.filter((v) => v !== preset) : [...value, preset]);
}

const FIELD =
	'h-11 w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15';
const FIELD_VALID =
	'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-500 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const CHIP =
	'inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80';
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const DELETE = `-me-1 inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300 ${FOCUS}`;
const PRESET_OFF = `inline-flex items-center gap-1 rounded-full bg-transparent px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 ring-1 ring-gray-500 ring-inset hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/80 dark:hover:bg-white/5 ${FOCUS}`;
const PRESET_ON = `${CHIP} hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10 ${FOCUS}`;
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</label>
		<TagsInputRoot
			:model-value="modelValue ?? []"
			:disabled="disabled"
			delimiter=","
			add-on-blur
			add-on-paste
			@update:model-value="emit('update:modelValue', $event as string[])"
		>
			<TagsInputInput
				:id="id"
				:placeholder="placeholder ?? t('interfaces.tags.add_tags')"
				:aria-labelledby="ariaLabelledby"
				:aria-invalid="invalid || !!error ? 'true' : undefined"
				:aria-describedby="describedBy"
				:class="[FIELD, invalid || error ? FIELD_INVALID : FIELD_VALID]"
			/>
			<div v-if="modelValue?.length" class="mt-2 flex flex-wrap gap-1.5">
				<TagsInputItem
					v-for="tag in modelValue"
					:key="tag"
					:value="tag"
					:class="CHIP"
					class="data-[state=active]:ring-2 data-[state=active]:ring-brand-500 dark:data-[state=active]:ring-brand-400"
				>
					<TagsInputItemText class="truncate" />
					<TagsInputItemDelete :class="DELETE" :aria-label="`${t('remove')} ${tag}`">
						<BoIcon name="close" size="sm" :style="{ fontSize: 'var(--text-theme-sm)' }" />
					</TagsInputItemDelete>
				</TagsInputItem>
			</div>
		</TagsInputRoot>
		<div v-if="presets.length" class="mt-2 flex flex-wrap gap-1.5">
			<button
				v-for="preset in presets"
				:key="preset"
				type="button"
				:disabled="disabled"
				:aria-pressed="modelValue?.includes(preset) ? 'true' : 'false'"
				:class="modelValue?.includes(preset) ? PRESET_ON : PRESET_OFF"
				@click="togglePreset(preset)"
			>
				<BoIcon
					v-if="modelValue?.includes(preset)"
					name="check"
					size="sm"
					:style="{ fontSize: 'var(--text-theme-sm)' }"
				/>
				{{ preset }}
			</button>
		</div>
		<p v-if="hint" :id="hintId" class="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
			class="mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400"
		>
			<BoIcon name="error" size="sm" />
			{{ error }}
		</p>
	</div>
</template>
