<!-- Ported from directus/app/src/views/private/components/save-options.vue -->
<script setup lang="ts">
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { translateShortcut } from '../composables/use-shortcut.ts';
import BoButton from './BoButton.vue';
import BoIcon from './BoIcon.vue';

type SaveOption = 'save-and-stay' | 'save-and-add-new' | 'save-as-copy' | 'discard-and-stay';

const props = defineProps<{
	disabledOptions?: string[];
}>();

const emit = defineEmits<{
	(e: 'save-and-stay'): void;
	(e: 'save-and-add-new'): void;
	(e: 'save-as-copy'): void;
	(e: 'discard-and-stay'): void;
}>();

const { t } = useI18n();

const OPTIONS: { value: SaveOption; icon: string; text: string; shortcut?: string[] }[] = [
	{ value: 'save-and-stay', icon: 'check', text: 'save_and_stay', shortcut: ['meta', 's'] },
	{ value: 'save-and-add-new', icon: 'add', text: 'save_and_create_new', shortcut: ['meta', 'shift', 's'] },
	{ value: 'save-as-copy', icon: 'done_all', text: 'save_as_copy' },
	{ value: 'discard-and-stay', icon: 'undo', text: 'discard_all_changes' },
];

const options = computed(() => OPTIONS.filter((option) => !props.disabledOptions?.includes(option.value)));

// Backoffice: one typed emit call per option; Directus writes four `$emit` calls in the template.
function select(value: SaveOption) {
	(emit as (e: SaveOption) => void)(value);
}
</script>

<template>
	<!-- Backoffice: split-button half of recipe Q-8 (secondary icon Button attached to the save Button) in place of the
	Directus VMenu with a clickable VIcon. -->
	<DropdownMenuRoot>
		<DropdownMenuTrigger as-child>
			<BoButton variant="secondary" icon="more_vert" :aria-label="t('more_save_options')" class="rounded-s-none" />
		</DropdownMenuTrigger>
		<DropdownMenuPortal>
			<DropdownMenuContent
				align="end"
				:side-offset="4"
				class="z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
			>
				<DropdownMenuItem
					v-for="option in options"
					:key="option.value"
					class="flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300"
					@select="select(option.value)"
				>
					<BoIcon :name="option.icon" size="sm" class="text-gray-500 dark:text-gray-400" />
					{{ t(option.text) }}
					<span v-if="option.shortcut" class="ms-auto ps-4 text-theme-xs text-gray-500">
						{{ translateShortcut(option.shortcut) }}
					</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenuPortal>
	</DropdownMenuRoot>
</template>
