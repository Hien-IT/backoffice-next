<!-- Ported from directus/app/src/components/v-form/components/form-field-menu.vue -->
<script setup lang="ts">
// Backoffice: the menu holds its own trigger, the chevron of the Field label row recipe (DR opens it from the
// whole label); items follow the Dropdown menu recipe on Reka DropdownMenu. Options and disable rules are DR'
// (FR-017, FR-066: view and copy raw value stay available on read-only fields).
import type { RelationalType } from '@directus/types';
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed } from 'vue';
import BoIcon from '../BoIcon.vue';
import { useClipboard } from './composables/use-clipboard.ts';
import type { FormField } from './types.ts';

export type MenuOptions =
	| 'edit-raw'
	| 'view-raw'
	| 'copy-raw'
	| 'paste-raw'
	| 'reset-to-default'
	| 'undo-changes'
	| 'clear-value';

// Backoffice: RELATIONAL_TYPES of @directus/constants (not a dependency of apps/web).
const RELATIONAL_TYPES = ['file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'translations'] as const;

const props = withDefaults(
	defineProps<{
		field: FormField;
		modelValue?: string | number | boolean | Record<string, any> | Array<any> | null | undefined;
		initialValue?: string | number | boolean | Record<string, any> | Array<any> | null | undefined;
		restricted?: boolean | undefined;
		disabledOptions?: MenuOptions[] | undefined;
	}>(),
	{
		modelValue: null,
		initialValue: null,
		disabledOptions: () => [],
	},
);

defineEmits(['update:modelValue', 'unset', 'edit-raw', 'copy-raw', 'paste-raw']);

const { isCopySupported, isPasteSupported } = useClipboard();

const defaultValue = computed(() => {
	const savedValue = props.field?.schema?.default_value;
	return savedValue !== undefined ? savedValue : null;
});

const isRequired = computed(() => {
	return props.field?.schema?.is_nullable === false;
});

const localDisabledOptions = computed(() => {
	const disabledOptions = new Set(props.disabledOptions);

	if (props.restricted) disabledOptions.add('edit-raw');

	if (!props.restricted) disabledOptions.add('view-raw');

	if (!isCopySupported.value) disabledOptions.add('copy-raw');

	if (!isPasteSupported.value || props.restricted) disabledOptions.add('paste-raw');

	if (defaultValue.value === null || props.restricted) disabledOptions.add('reset-to-default');

	if (!props.initialValue || props.restricted) disabledOptions.add('undo-changes');

	if ((isRequired.value && defaultValue.value !== null) || props.restricted) disabledOptions.add('clear-value');

	return disabledOptions;
});

const showDivider = computed(() => {
	const upperOptions = (['edit-raw', 'view-raw', 'copy-raw', 'paste-raw'] as MenuOptions[]).some(
		(option) => !localDisabledOptions.value.has(option),
	);

	const lowerOptions = (['reset-to-default', 'undo-changes', 'clear-value'] as MenuOptions[]).some(
		(option) => !localDisabledOptions.value.has(option),
	);

	return upperOptions && lowerOptions;
});

const relational = computed(
	() =>
		props.field.meta?.special?.find((type) => RELATIONAL_TYPES.includes(type as RelationalType)) !== undefined,
);

const ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
</script>

<template>
	<DropdownMenuRoot>
		<DropdownMenuTrigger
			:aria-label="`${field.name}: ${$t('options')}`"
			class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-500 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 data-[state=open]:opacity-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 dark:focus-visible:outline-brand-400"
		>
			<BoIcon name="expand_more" size="sm" />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent
				side="bottom"
				align="start"
				:side-offset="4"
				class="z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
			>
				<DropdownMenuItem v-if="!localDisabledOptions.has('edit-raw')" :class="ITEM" @select="$emit('edit-raw')">
					<BoIcon name="code" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('edit_raw_value') }}
				</DropdownMenuItem>
				<DropdownMenuItem v-if="!localDisabledOptions.has('view-raw')" :class="ITEM" @select="$emit('edit-raw')">
					<BoIcon name="code" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('view_raw_value') }}
				</DropdownMenuItem>
				<DropdownMenuItem
					v-if="!localDisabledOptions.has('copy-raw')"
					:disabled="modelValue === null"
					:class="ITEM"
					@select="$emit('copy-raw')"
				>
					<BoIcon name="content_copy" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('copy_raw_value') }}
				</DropdownMenuItem>
				<DropdownMenuItem v-if="!localDisabledOptions.has('paste-raw')" :class="ITEM" @select="$emit('paste-raw')">
					<BoIcon name="content_paste" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('paste_raw_value') }}
				</DropdownMenuItem>
				<DropdownMenuSeparator v-if="showDivider" class="my-1 border-t border-gray-200 dark:border-gray-800" />
				<DropdownMenuItem
					v-if="!localDisabledOptions.has('reset-to-default')"
					:disabled="modelValue === defaultValue"
					:class="ITEM"
					@select="$emit('update:modelValue', defaultValue)"
				>
					<BoIcon name="settings_backup_restore" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('reset_to_default') }}
				</DropdownMenuItem>
				<DropdownMenuItem
					v-if="!localDisabledOptions.has('undo-changes')"
					:disabled="initialValue === undefined || modelValue === initialValue"
					:class="ITEM"
					@select="$emit('unset', field)"
				>
					<BoIcon name="undo" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('undo_changes') }}
				</DropdownMenuItem>
				<DropdownMenuItem
					v-if="!localDisabledOptions.has('clear-value')"
					:disabled="modelValue === null || relational"
					:class="ITEM"
					@select="$emit('update:modelValue', null)"
				>
					<BoIcon name="delete" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ $t('clear_value') }}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
