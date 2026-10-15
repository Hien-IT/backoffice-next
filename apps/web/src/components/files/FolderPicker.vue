<!-- Ported from directus/app/src/views/private/components/folder-picker.vue; Ported from directus/app/src/views/private/components/FolderPickerListItem.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §11 (rows without menus) and component-specs 015 "File page": one `role="tree"`
// of rows with `aria-level` (FolderPickerListItem's recursion flattened), single select with `aria-selected`, the
// WAI-ARIA tree keyboard (use-tree-keyboard), Enter or Space selects. Folders load once per picker with
// `GET /folders?limit=-1&sort=name` as Directus. Directus computes the open parents before the folders load, so only
// the root opens; here the parents of the selected folder open once the folders are in (the evident intent). A disabled
// folder (`disabledFolders`, the folder being moved) can neither be selected nor opened, so its sub folders stay out of
// reach as with Directus' disabled v-list-group.
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { useTreeKeyboard, type TreeRow } from '../../composables/use-tree-keyboard.ts';
import { unexpectedError } from '../../utils/unexpected-error.ts';
import BoIcon from '../BoIcon.vue';

type FolderRaw = { id: string; name: string; parent: null | string };

type Row = TreeRow & { level: number; name: string; value: string | null; disabled: boolean };

const props = defineProps<{
	modelValue: string | null;
	disabledFolders?: string[] | undefined;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string | null];
}>();

const { t } = useI18n();

const ROOT = 'root';

const loading = ref(false);
const folders = ref<FolderRaw[]>([]);
const openFolders = ref<string[]>([ROOT]);
const tree = useTemplateRef<HTMLElement>('tree');

const childrenOf = computed(() => {
	const map = new Map<string | null, FolderRaw[]>();

	for (const folder of folders.value) {
		const list = map.get(folder.parent) ?? [];
		list.push(folder);
		map.set(folder.parent, list);
	}

	return map;
});

const rows = computed<Row[]>(() => {
	const result: Row[] = [];
	const top = childrenOf.value.get(null) ?? [];

	result.push({
		key: ROOT,
		parent: null,
		children: top.map((folder) => folder.id),
		level: 1,
		name: t('file_library'),
		value: null,
		disabled: false,
	});

	if (isOpen(ROOT)) walk(top, ROOT, 2);

	return result;

	function walk(list: FolderRaw[], parent: string, level: number) {
		for (const folder of list) {
			const children = childrenOf.value.get(folder.id) ?? [];
			const disabled = props.disabledFolders?.includes(folder.id) ?? false;

			result.push({
				key: folder.id,
				parent,
				children: disabled ? [] : children.map((child) => child.id),
				level,
				name: folder.name,
				value: folder.id,
				disabled,
			});

			if (!disabled && isOpen(folder.id)) walk(children, folder.id, level + 1);
		}
	}
});

const selectedKey = computed(() => props.modelValue ?? ROOT);

const { tabStop, onKeydown, onFocusin } = useTreeKeyboard({
	rows,
	isOpen,
	toggle,
	activeKey: selectedKey,
	tree,
});

watch(folders, openParentsOfSelection);

fetchFolders();

async function fetchFolders() {
	if (folders.value.length > 0) return;
	loading.value = true;

	try {
		folders.value = await sdk.request(
			requestEndpoint<FolderRaw[]>('/folders', { method: 'GET', params: { limit: -1, sort: 'name' } }),
		);
	} catch (error) {
		unexpectedError(error);
	} finally {
		loading.value = false;
	}
}

function openParentsOfSelection() {
	let folder = folders.value.find((item) => item.id === props.modelValue);
	const parents: string[] = [];

	while (folder?.parent) {
		parents.push(folder.parent);
		folder = folders.value.find((item) => item.id === folder!.parent);
	}

	openFolders.value = [...new Set([...openFolders.value, ...parents])];
}

function isOpen(key: string) {
	return openFolders.value.includes(key);
}

function toggle(key: string) {
	openFolders.value = isOpen(key) ? openFolders.value.filter((item) => item !== key) : [...openFolders.value, key];
}

function select(row: Row) {
	if (row.disabled) return;
	emit('update:modelValue', row.value);
}

function onRowKeydown(event: KeyboardEvent, row: Row) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		select(row);
	}
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div v-if="loading" class="space-y-2" aria-busy="true">
		<div
			v-for="n in 4"
			:key="n"
			class="h-9 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
		/>
	</div>
	<ul
		v-else
		ref="tree"
		role="tree"
		:aria-label="$t('folder')"
		class="folder-picker m-0 flex list-none flex-col gap-1 p-0"
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
			:aria-selected="selectedKey === row.key"
			:aria-disabled="row.disabled || undefined"
		>
			<div
				class="menu-dropdown-item min-h-9 gap-2 py-1 text-sm"
				:class="[
					selectedKey === row.key ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive',
					{ 'cursor-not-allowed opacity-50': row.disabled },
				]"
				:style="{ paddingInlineStart: `${0.75 + (row.level - 1)}rem` }"
			>
				<button
					v-if="row.children.length > 0"
					type="button"
					tabindex="-1"
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
				<div
					data-tree-row
					:tabindex="tabStop === row.key ? 0 : -1"
					class="flex min-w-0 flex-1 items-center gap-2 rounded outline-hidden"
					:class="[FOCUS, row.disabled ? '' : 'cursor-pointer']"
					@click="select(row)"
					@keydown="onRowKeydown($event, row)"
				>
					<BoIcon
						:name="row.value === null ? 'folder_special' : selectedKey === row.key ? 'folder_open' : 'folder'"
						size="sm"
						class="shrink-0"
					/>
					<span class="truncate">{{ row.name }}</span>
				</div>
			</div>
		</li>
	</ul>
</template>
