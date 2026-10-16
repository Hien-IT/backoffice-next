<!-- Ported from directus/app/src/interfaces/_system/system-folder/folder.vue; Ported from directus/app/src/interfaces/_system/system-folder/FolderListItem.vue -->
<script setup lang="ts">
// Backoffice (spec 016, recipe Q-25): a read-only input with the folder path (useFolders as Directus) and a trailing
// folder button opening a Popover with the 015 FolderPicker tree (rows of FolderListItem, keyboard tree) whose root row
// is `interfaces.system-folder.root_name`; choosing a row emits its id (root: null) and closes the popover.
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import FolderPicker from '../../../components/files/FolderPicker.vue';
import { type Folder, useFolders } from '../../../composables/use-folders.ts';

const props = defineProps<{
	value: string | null;
	disabledFolders?: string[];
	disabled?: boolean;
	placeholder?: string;
}>();

const emit = defineEmits<{
	input: [value: string | null];
}>();

const { t } = useI18n();

const { folders, loading } = useFolders();

const open = ref(false);

const folderPath = computed(() => {
	if (!props.value || !folders.value) {
		return t('interfaces.system-folder.root_name');
	}

	const folder = folders.value.find((folder) => folder.id === props.value);
	return folder
		? folderParentPath(folder as Folder, folders.value)
				.map((folder) => folder.name)
				.join(' / ')
		: props.value;
});

function emitValue(id: string | null) {
	open.value = false;
	return emit('input', id);
}

function folderParentPath(folder: Folder, folders: Folder[]) {
	const folderMap = new Map(folders.map((folder) => [folder.id, folder]));

	const folderParent = (target: Folder): Folder[] =>
		(target.parent && folderMap.has(target.parent) ? folderParent(folderMap.get(target.parent) as Folder) : []).concat(
			target,
		);

	return folderParent(folder);
}

const INPUT =
	'h-11 w-full min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 ps-11 text-sm text-gray-800 shadow-theme-xs focus:outline-hidden dark:border-gray-700 dark:text-white/90';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<div v-if="loading" class="h-11 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800" />
	<PopoverRoot v-else v-model:open="open">
		<div class="relative flex items-center gap-2">
			<BoIcon
				:name="!value ? 'folder_special' : 'folder_open'"
				class="pointer-events-none absolute start-3.5 text-gray-500 dark:text-gray-400"
			/>
			<input
				readonly
				:value="folderPath"
				:placeholder="placeholder"
				:disabled="disabled"
				:aria-label="$t('interfaces.system-folder.folder')"
				:class="INPUT"
			/>
			<PopoverTrigger
				:disabled="disabled"
				class="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400"
				:aria-label="$t('interfaces.system-folder.description')"
				:title="$t('interfaces.system-folder.description')"
			>
				<BoIcon name="folder" />
			</PopoverTrigger>
		</div>
		<PopoverPortal>
			<PopoverContent :side-offset="4" align="end" :collision-padding="8" :class="POPOVER">
				<FolderPicker
					:model-value="value"
					:disabled-folders="disabledFolders"
					:root-label="$t('interfaces.system-folder.root_name')"
					@update:model-value="emitValue"
				/>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
