<!-- Ported from directus/app/src/views/private/components/drawer-files.vue; Ported from directus/app/src/utils/get-folder-filter.ts -->
<script setup lang="ts">
// Backoffice: files-navigation.vue (folder tree sidebar) is a folder select above the table with the same targets
// (the root or `folder`, its sub folders, all files, my files, recent files); folders come from GET /folders as
// use-folders.ts, once per drawer when it first opens. utils/get-folder-filter.ts is inlined. The session storage key
// prefix is `backoffice-` (D-39). The MIME type filter is merged into `filter` by the interface, as in DR
// (file.vue customFilter with useMimeTypeFilter). Pattern for BoUpload: `@library` opens this drawer and its `input`
// goes to the exposed `setSelection` of BoUpload (v-upload.vue renders drawer-files itself).
import type { Filter } from '@directus/types';
import { mergeFilters } from '@directus/utils';
import { useSessionStorage } from '@vueuse/core';
import { subDays } from 'date-fns';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '../../stores/user.ts';
import { fetchAll } from '../../utils/fetch-all.ts';
import BoSelect from '../BoSelect.vue';
import DrawerCollection from './DrawerCollection.vue';

type SpecialFolder = 'all' | 'mine' | 'recent';
type FolderTarget = { folder?: string | undefined; special?: SpecialFolder | undefined };
type FolderRaw = { id: string; name: string; parent: string | null };

const props = withDefaults(
	defineProps<{
		collection?: string;
		folder?: string | undefined;
		field?: string | undefined;
		filter?: Filter | undefined;
		/** Backoffice: declared (and passed on) so the folders load when the drawer opens. */
		active?: boolean | undefined;
	}>(),
	{
		collection: 'directus_files',
		folder: undefined,
		field: undefined,
		filter: undefined,
		active: undefined,
	},
);

// Backoffice: declaring `active` stops Vue from passing `onUpdate:active` through to DrawerCollection (DR does
// not declare it), so Cancel, Esc and Save never closed the drawer: it is re-emitted (T094).
const emit = defineEmits<{ (e: 'update:active', value: boolean): void }>();

const { t } = useI18n();

// Positional key so that collection, field, and folder contexts never collide
// (e.g. field="avatar" → "directus_files:avatar:", collection="articles", field="avatar" → "articles:avatar:")
const stateKey = `${props.collection ?? ''}:${props.field ?? ''}:${props.folder ?? ''}`;

const persisted = useSessionStorage<{ folder?: string | undefined; special?: SpecialFolder | undefined }>(
	`backoffice-drawer-files-state:${stateKey}`,
	{ folder: props.folder, special: undefined },
);

const currentFolder = ref<string | undefined>(persisted.value.folder);
const currentSpecial = ref<SpecialFolder | undefined>(persisted.value.special);
const folderFilter = ref<Filter>();

const userStore = useUserStore();

watch(
	[currentFolder, currentSpecial],
	() => {
		persisted.value = { folder: currentFolder.value, special: currentSpecial.value };
		folderFilter.value = getFolderFilter(currentFolder.value, currentSpecial.value, currentUserId());
	},
	{ immediate: true },
);

// Backoffice: a share user has no id.
function currentUserId() {
	const user = userStore.currentUser;
	return user && 'id' in user ? user.id : undefined;
}

function onFolderChange(target: FolderTarget) {
	currentFolder.value = target.folder;
	currentSpecial.value = target.special;
}

const { folders, fetchFolders } = useFolders();

watch(
	() => props.active,
	(active) => {
		if (active && folders.value === null) fetchFolders();
	},
	{ immediate: true },
);

// files-navigation.vue: the root (or `folder`) and its sub folders, then the special folders.
const folderItems = computed(() => {
	const rootName = folders.value?.find((folder) => folder.id === props.folder)?.name ?? t('file_library');
	const items = [{ text: rootName, value: props.folder ?? 'root' }];

	const addChildren = (parent: string | null, depth: number) => {
		for (const folder of folders.value ?? []) {
			if (folder.parent !== parent) continue;
			items.push({ text: `${'  '.repeat(depth * 2)}${folder.name}`, value: folder.id });
			addChildren(folder.id, depth + 1);
		}
	};

	addChildren(props.folder ?? null, 1);

	return [
		...items,
		{ text: t('all_files'), value: 'special:all' },
		{ text: t('my_files'), value: 'special:mine' },
		{ text: t('recent_files'), value: 'special:recent' },
	];
});

const folderValue = computed(() =>
	currentSpecial.value ? `special:${currentSpecial.value}` : (currentFolder.value ?? props.folder ?? 'root'),
);

function onFolderSelect(value: string) {
	if (value.startsWith('special:')) onFolderChange({ special: value.slice('special:'.length) as SpecialFolder });
	else onFolderChange(value === 'root' ? {} : { folder: value });
}

// use-folders.ts fetchFolders (no shared cache, no nesting: the select lists the folders depth first).
function useFolders() {
	const folders = ref<FolderRaw[] | null>(null);

	return { folders, fetchFolders };

	async function fetchFolders() {
		try {
			folders.value = await fetchAll<FolderRaw>(`/folders`, { params: { sort: 'name' } });
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn(error);
		}
	}
}

// Ported from directus/app/src/utils/get-folder-filter.ts
function getFolderFilter(folder?: string, special?: SpecialFolder, currentUserId?: string): Filter {
	const filterParsed: Filter = {
		_and: [
			{
				type: {
					_nnull: true,
				},
			},
		],
	};

	if (!special) {
		if (folder) {
			filterParsed._and.push({
				folder: {
					_eq: folder,
				},
			});
		} else {
			filterParsed._and.push({
				folder: {
					_null: true,
				},
			});
		}
	}

	if (special === 'mine' && currentUserId) {
		filterParsed._and.push({
			uploaded_by: {
				_eq: currentUserId,
			},
		});
	}

	if (special === 'recent') {
		filterParsed._and.push({
			uploaded_on: {
				_gt: subDays(new Date(), 5).toISOString(),
			},
		});
	}

	return filterParsed;
}
</script>

<template>
	<DrawerCollection
		:collection="collection"
		:active="active"
		:filter="mergeFilters(filter ?? null, folderFilter ?? null) ?? undefined"
		@update:active="emit('update:active', $event)"
	>
		<template #sidebar>
			<BoSelect
				:model-value="folderValue"
				:items="folderItems"
				:label="t('folder')"
				@update:model-value="onFolderSelect"
			/>
		</template>
	</DrawerCollection>
</template>
