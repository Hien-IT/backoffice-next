<!-- Ported from directus/app/src/views/private/components/files-navigation.vue; Ported from directus/app/src/views/private/components/files-navigation-folder.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §11 (Q-13), rendered in the `navigation` slot of AppSidebar like the Content tree
// (Clarifications Q3). files-navigation-folder.vue's recursion is flattened into rows with `aria-level`, walked with the
// WAI-ARIA tree keyboard (use-tree-keyboard). The root "File Library" row holds the folders; the special views are
// flat links after a divider. Rows are router links unless `customTargetHandler` is given (the files drawer), then
// they call it. The folder menu (rename, move, download, delete) is one Reka ContextMenu on the tree (right click on
// a folder row) plus a row menu button for the keyboard; its dialogs live here once instead of per folder. Errors show
// in the dialogs (D-66) instead of the unexpectedError dialog.
import { getDateTimeFormatted } from '@directus/utils';
import { isEqual } from 'lodash-es';
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';
import { computed, ref, toRefs, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import { apiFetch, requestEndpoint, sdk } from '../../api/sdk.ts';
import { type Folder, useFolders } from '../../composables/use-folders.ts';
import { useTreeKeyboard, type TreeRow } from '../../composables/use-tree-keyboard.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import DeleteFolderDialog from '../../modules/files/components/DeleteFolderDialog.vue';
import type { FolderTarget, SpecialFolder } from '../../types/folders.ts';
import { saveResponse } from '../../utils/save-response.ts';
import { unexpectedError } from '../../utils/unexpected-error.ts';
import BoButton from '../BoButton.vue';
import BoDialog from '../BoDialog.vue';
import BoIcon from '../BoIcon.vue';
import BoInput from '../BoInput.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';
import BoNotice from '../BoNotice.vue';
import BoTextOverflow from '../BoTextOverflow.vue';
import FolderPicker from './FolderPicker.vue';

type Row = TreeRow & { level: number; name: string; folder: Folder | null; target: FolderTarget };

const props = defineProps<{
	rootFolder?: string | undefined;
	currentFolder?: string | undefined;
	currentSpecial?: SpecialFolder | undefined;
	customTargetHandler?: ((target: FolderTarget) => void) | undefined;
	localOpenFolders?: boolean | undefined;
	actionsDisabled?: boolean | undefined;
}>();

const { t } = useI18n();
const router = useRouter();

const { rootFolder, localOpenFolders } = toRefs(props);

const { nestedFolders, folders, loading, openFolders, fetchFolders } = useFolders(rootFolder, localOpenFolders);

const tree = useTemplateRef<HTMLElement>('tree');

const rootKey = computed(() => props.rootFolder ?? 'root');

const rootFolderInfo = computed(() => {
	if (!folders.value || !props.rootFolder) return;

	return folders.value.find((folder) => folder.id === props.rootFolder);
});

const rows = computed<Row[]>(() => {
	const top = nestedFolders.value ?? [];

	const result: Row[] = [
		{
			key: rootKey.value,
			parent: null,
			children: top.map((folder) => folder.id),
			level: 1,
			name: rootFolderInfo.value?.name ?? t('file_library'),
			folder: null,
			target: props.rootFolder ? { folder: props.rootFolder } : {},
		},
	];

	if (isOpen(rootKey.value)) walk(top, rootKey.value, 2);

	return result;

	function walk(list: Folder[], parent: string, level: number) {
		for (const folder of list) {
			const children = folder.children ?? [];

			result.push({
				key: folder.id,
				parent,
				children: children.map((child) => child.id),
				level,
				name: folder.name,
				folder,
				target: { folder: folder.id },
			});

			if (isOpen(folder.id)) walk(children, folder.id, level + 1);
		}
	}
});

const activeKey = computed(() => {
	if (!props.currentFolder && !props.currentSpecial) return rootKey.value;
	if (props.currentFolder !== undefined && props.currentFolder === props.rootFolder) return rootKey.value;
	return props.currentFolder ?? null;
});

const { tabStop, onKeydown, onFocusin } = useTreeKeyboard({ rows, isOpen, toggle, activeKey, tree });

const specials: { special: SpecialFolder; icon: string; text: string }[] = [
	{ special: 'all', icon: 'file_copy', text: 'all_files' },
	{ special: 'mine', icon: 'folder_shared', text: 'my_files' },
	{ special: 'recent', icon: 'history', text: 'recent_files' },
];

watch([() => props.currentFolder, loading], setOpenFolders, { immediate: true });

function isOpen(key: string) {
	return openFolders.value?.includes(key) ?? false;
}

function toggle(key: string) {
	const open = openFolders.value ?? [];
	openFolders.value = open.includes(key) ? open.filter((item) => item !== key) : [...open, key];
}

function targetPath(target: FolderTarget) {
	const path = ['files'];
	if (target.folder) path.push('folders', target.folder);

	if (target.special) {
		path.push(target.special);
	}

	return `/${path.join('/')}`;
}

function onClick(target: FolderTarget) {
	if (props.customTargetHandler) {
		props.customTargetHandler(target);
	} else {
		router.push(targetPath(target));
	}
}

function onRowKeydown(event: KeyboardEvent, target: FolderTarget) {
	// Links follow natively; the custom handler rows are not links.
	if (props.customTargetHandler && (event.key === 'Enter' || event.key === ' ')) {
		event.preventDefault();
		onClick(target);
	}
}

function setOpenFolders() {
	if (!folders.value) return;
	if (!openFolders?.value) return;

	const shouldBeOpen: string[] = [];
	const folder = folders.value.find((folder) => folder.id === props.currentFolder);

	if (folder?.parent) parseFolder(folder.parent);

	const newOpenFolders = [...openFolders.value];

	for (const folderID of shouldBeOpen) {
		if (newOpenFolders.includes(folderID) === false) {
			newOpenFolders.push(folderID);
		}
	}

	if (newOpenFolders.length !== 1 && isEqual(newOpenFolders, openFolders.value) === false) {
		openFolders.value = newOpenFolders;
	}

	function parseFolder(id: string) {
		if (!folders.value) return;
		shouldBeOpen.push(id);

		const folder = folders.value.find((folder) => folder.id === id);

		if (folder && folder.parent) {
			parseFolder(folder.parent);
		}
	}
}

/* ---------------------------------------------------------------------------------------------- folder actions */

const menuFolder = ref<Folder | null>(null);
const dialogFolder = ref<Folder | null>(null);
const renameActive = ref(false);
const renameValue = ref<string | null>(null);
const moveActive = ref(false);
const moveValue = ref<string | null>(null);
const deleteActive = ref(false);
const saving = ref(false);
const actionError = ref<string | null>(null);

function menuItems(folder: Folder): BoMenuItem[] {
	return [
		{ text: t('rename_folder'), icon: 'edit', onSelect: () => openRename(folder) },
		{ text: t('move_to_folder'), icon: 'folder_move', onSelect: () => openMove(folder) },
		{ text: t('download_folder'), icon: 'download', onSelect: () => downloadFolder(folder) },
		{ text: t('delete_folder'), icon: 'delete', onSelect: () => openDelete(folder) },
	];
}

// Capture phase: picks the folder of the row before the Reka trigger opens; no folder keeps the browser menu.
function onContextMenu(event: MouseEvent) {
	const key = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
	menuFolder.value = rows.value.find((row) => row.key === key)?.folder ?? null;

	if (menuFolder.value === null || props.actionsDisabled) event.stopPropagation();
}

function openRename(folder: Folder) {
	dialogFolder.value = folder;
	renameValue.value = folder.name;
	actionError.value = null;
	renameActive.value = true;
}

function openMove(folder: Folder) {
	dialogFolder.value = folder;
	moveValue.value = folder.parent;
	actionError.value = null;
	moveActive.value = true;
}

function openDelete(folder: Folder) {
	dialogFolder.value = folder;
	deleteActive.value = true;
}

async function renameSave() {
	if (!dialogFolder.value || !renameValue.value || saving.value) return;

	await patchFolder({ name: renameValue.value }, renameActive);
}

async function moveSave() {
	if (!dialogFolder.value || saving.value) return;

	await patchFolder({ parent: moveValue.value }, moveActive);
}

async function patchFolder(body: Record<string, unknown>, active: typeof renameActive) {
	saving.value = true;
	actionError.value = null;

	try {
		await sdk.request(requestEndpoint(`/folders/${dialogFolder.value!.id}`, { method: 'PATCH', body }));
		await fetchFolders();
		active.value = false;
	} catch (error) {
		actionError.value = translateAPIError(unexpectedError(error) as APIError);
	} finally {
		saving.value = false;
	}
}

function onDeleted() {
	const newParent = dialogFolder.value?.parent;

	if (newParent) {
		router.replace({ name: 'folders-collection', params: { folder: newParent } });
	} else {
		router.replace({ name: 'files-collection' });
	}

	fetchFolders();
}

async function downloadFolder(folder: Folder) {
	try {
		const response = await apiFetch(`/assets/folder/${folder.id}?download=`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});

		await saveResponse(response, `folder-unknown-${getDateTimeFormatted()}.zip`);
	} catch (error) {
		unexpectedError(error);
	}
}

defineExpose({ openRename, downloadFolder });

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

const ROW =
	'menu-dropdown-item min-h-9 gap-2 py-1 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 dark:has-focus-visible:outline-brand-400';

const MENU_ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('file_library')" @contextmenu.capture="onContextMenu">
		<div v-if="loading && (nestedFolders === null || nestedFolders.length === 0)" class="space-y-1" aria-busy="true">
			<div
				v-for="n in 4"
				:key="n"
				class="h-9 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
			/>
		</div>

		<ContextMenuRoot v-else>
			<ContextMenuTrigger as-child>
				<ul
					ref="tree"
					role="tree"
					:aria-label="$t('file_library')"
					class="m-0 flex list-none flex-col gap-1 p-0"
					@keydown="onKeydown"
					@focusin="onFocusin"
				>
					<li
						v-for="row in rows"
						:key="row.key"
						role="treeitem"
						:data-key="row.key"
						:aria-level="row.level"
						:aria-expanded="row.children.length > 0 ? isOpen(row.key) : undefined"
						:aria-selected="activeKey === row.key"
					>
						<div
							class="group"
							:class="[ROW, activeKey === row.key ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
							:style="{ paddingInlineStart: `${0.75 + (row.level - 1)}rem` }"
						>
							<button
								v-if="row.children.length > 0"
								type="button"
								tabindex="-1"
								data-tree-ignore
								class="relative z-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded"
								:class="FOCUS"
								:aria-label="`${isOpen(row.key) ? $t('collapse') : $t('expand')} ${row.name}`"
								@click="toggle(row.key)"
							>
								<BoIcon
									name="chevron_right"
									size="sm"
									class="transition-transform motion-reduce:transition-none"
									:class="{ 'rotate-90': isOpen(row.key) }"
								/>
							</button>
							<span v-else class="size-6 shrink-0" aria-hidden="true" />

							<component
								:is="customTargetHandler ? 'div' : RouterLink"
								v-bind="customTargetHandler ? {} : { to: targetPath(row.target) }"
								data-tree-row
								:tabindex="tabStop === row.key ? 0 : -1"
								:aria-current="!customTargetHandler && activeKey === row.key ? 'page' : undefined"
								class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 no-underline outline-hidden after:absolute after:inset-0 after:rounded-lg"
								@click="customTargetHandler && onClick(row.target)"
								@keydown="onRowKeydown($event, row.target)"
							>
								<BoIcon :name="row.folder ? 'folder' : 'folder_special'" size="sm" class="shrink-0" />
								<BoTextOverflow :text="row.name" />
							</component>

							<BoMenu v-if="row.folder && !actionsDisabled" :items="menuItems(row.folder)" align="end">
								<template #trigger>
									<button
										type="button"
										data-tree-ignore
										class="relative z-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
										:class="FOCUS"
										:tabindex="tabStop === row.key ? 0 : -1"
										:aria-label="$t('item_options', { item: row.name })"
									>
										<BoIcon name="more_vert" size="sm" />
									</button>
								</template>
							</BoMenu>
						</div>
					</li>
				</ul>
			</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent
					class="z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
				>
					<template v-if="menuFolder">
						<ContextMenuItem
							v-for="item in menuItems(menuFolder)"
							:key="item.text"
							:class="MENU_ITEM"
							@select="item.onSelect?.()"
						>
							<BoIcon :name="item.icon!" size="sm" class="text-gray-500 dark:text-gray-400" />
							{{ item.text }}
						</ContextMenuItem>
					</template>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenuRoot>

		<div class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />

		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			<li v-for="item in specials" :key="item.special">
				<component
					:is="customTargetHandler ? 'button' : RouterLink"
					v-bind="customTargetHandler ? { type: 'button' } : { to: targetPath({ special: item.special }) }"
					class="w-full no-underline"
					:class="[
						ROW,
						FOCUS,
						currentSpecial === item.special ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive',
					]"
					:aria-current="!customTargetHandler && currentSpecial === item.special ? 'page' : undefined"
					@click="customTargetHandler && onClick({ special: item.special })"
				>
					<span class="size-6 shrink-0" aria-hidden="true" />
					<BoIcon :name="item.icon" size="sm" class="shrink-0" />
					<BoTextOverflow :text="$t(item.text)" />
				</component>
			</li>
		</ul>

		<BoDialog v-model:open="renameActive" :title="$t('rename_folder')">
			<form id="rename-folder-form" class="flex flex-col gap-4" @submit.prevent="renameSave">
				<BoInput v-model="renameValue" :label="$t('folder_name')" autofocus />
				<BoNotice v-if="actionError" type="danger">{{ actionError }}</BoNotice>
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="renameActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" form="rename-folder-form" :disabled="!renameValue" :loading="saving">
					{{ $t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog v-model:open="moveActive" :title="$t('move_to_folder')">
			<div class="flex flex-col gap-4">
				<FolderPicker v-model="moveValue" :disabled-folders="dialogFolder ? [dialogFolder.id] : []" />
				<BoNotice v-if="actionError" type="danger">{{ actionError }}</BoNotice>
			</div>
			<template #actions>
				<BoButton variant="secondary" @click="moveActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton :loading="saving" @click="moveSave">{{ $t('save') }}</BoButton>
			</template>
		</BoDialog>

		<DeleteFolderDialog
			v-model="deleteActive"
			:folders="dialogFolder ? [dialogFolder] : []"
			:all-folders="folders ?? []"
			@done="onDeleted"
		/>
	</nav>
</template>
