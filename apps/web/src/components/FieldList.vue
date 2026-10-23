<!-- Ported from directus/app/src/components/v-field-list/v-field-list.vue; Ported from directus/app/src/components/v-field-list/VFieldListItem.vue -->
<script setup lang="ts">
// Backoffice: recipe "Search and advanced filter (Q-7)" → Field list and the tree rules of layout-patterns §9. The
// VFieldListItem recursion becomes one flat `role="tree"` list of `treeitem` rows (aria-level, roving tabindex,
// Up/Down/Left/Right/Home/End, Enter/Space) built from the same field tree (composables/use-field-tree.ts, 016). Groups
// are opened while searching once per search change (DR: open + collapse-on-change), then toggle freely. No
// search highlight (BoTextOverflow has no `highlight`). Readable fields only = the fields store, which holds what
// `GET /fields` returns for the user, as in DR. Spec 020 (VFieldTemplate shim): `fieldTree` lists a given field
// tree instead of the collection's, `loadPathLevel` loads a level when a node opens (with its key, as
// v-field-template) and `depth` stops the nesting (0 = top level only).
import formatTitle from '@directus/format-title';
import type { Field } from '@directus/types';
import { getFunctionsForType } from '@directus/utils';
import { debounce, isNil } from 'lodash-es';
import { computed, nextTick, ref, toRefs, unref, useId, watch } from 'vue';
import { useFakeVersionField } from '../composables/use-fake-version-field.ts';
import { type FieldNode, useFieldTree } from '../composables/use-field-tree.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import BoIcon from './BoIcon.vue';
import BoInput from './BoInput.vue';
import BoTextOverflow from './BoTextOverflow.vue';

type FieldInfo = FieldNode & { disabled: boolean; children?: FieldInfo[] | undefined };

type Row =
	| { kind: 'field'; id: string; level: number; parent: string | null; node: FieldInfo; expandable: boolean }
	| { kind: 'function'; id: string; level: number; parent: string | null; node: FieldInfo; fn: string }
	| { kind: 'select-all'; id: string; level: number; parent: string | null; nodes: FieldInfo[]; root: boolean };

const props = withDefaults(
	defineProps<{
		collection: string;
		field?: string | undefined;
		disabledFields?: string[];
		includeFunctions?: boolean;
		includeRelations?: boolean;
		injectVersionField?: boolean;
		relationalFieldSelectable?: boolean;
		allowSelectAll?: boolean;
		rawFieldNames?: boolean;
		fieldFilter?: ((field: Field) => boolean) | undefined;
		fieldTree?: FieldNode[] | undefined;
		loadPathLevel?: ((fieldPath: string) => void) | undefined;
		depth?: number | undefined;
	}>(),
	{
		field: undefined,
		disabledFields: () => [],
		includeFunctions: false,
		includeRelations: true,
		injectVersionField: false,
		relationalFieldSelectable: true,
		allowSelectAll: false,
		rawFieldNames: false,
		fieldFilter: undefined,
		fieldTree: undefined,
		loadPathLevel: undefined,
		depth: undefined,
	},
);

const emit = defineEmits<{ add: [keys: string[]] }>();

const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const { collection, includeRelations } = toRefs(props);

const search = ref('');

const showSearch = computed(() => {
	const fields = fieldsStore.getFieldsForCollection(collection.value);
	if (!fields.length) return false;

	if (fields?.length > 10) return true;

	const anyGroupExists = fields.some((field) => field.meta?.group !== null);
	if (anyGroupExists) return true;

	const anyRelationExists = relationsStore.getRelationsForCollection(collection.value)?.length;
	if (anyRelationExists) return true;

	return false;
});

const collectionInfo = computed(() => collectionsStore.getCollection(collection.value));
const versioningEnabled = computed(() => Boolean(collectionInfo.value?.meta?.versioning && props.injectVersionField));
const { fakeVersionField } = useFakeVersionField(collection, versioningEnabled);

const injectFields = computed(() => {
	return fakeVersionField.value ? { fields: [fakeVersionField.value] } : null;
});

const {
	treeList: treeListOriginal,
	loadFieldRelations,
	refresh,
} = useFieldTree(collection, injectFields, filter, includeRelations);

const open = ref(new Set<string>());

const debouncedRefresh = debounce(() => {
	refresh();
	open.value = new Set(search.value ? groupPaths(treeList.value) : []);
}, 250);

watch(search, () => debouncedRefresh());

const treeList = computed<FieldInfo[]>(() => {
	const list = (props.fieldTree ?? treeListOriginal.value).map(setDisabled);

	if (props.field) return list.filter((fieldNode) => fieldNode.field === props.field);

	return list;

	function setDisabled(field: FieldNode): FieldInfo {
		let disabled = field.group || false;

		if (props.disabledFields?.includes(field.key)) disabled = true;

		return {
			...field,
			disabled,
			children: field.children?.map(setDisabled),
		};
	}
});

function filter(field: Field, parent?: FieldNode): boolean {
	if (props.fieldFilter && props.fieldFilter(field) === false) {
		return false;
	}

	if (
		!includeRelations.value &&
		(field.collection !== collection.value || (field.type === 'alias' && !field.meta?.special?.includes('group')))
	) {
		return false;
	}

	if (!search.value) {
		return true;
	}

	const children = isNil(field.schema?.foreign_key_table)
		? fieldsStore.getFieldGroupChildren(field.collection, field.field)
		: fieldsStore.getFieldsForCollection(field.schema!.foreign_key_table);

	return children?.some(matchesInNestedGroups) || matchesSearch(field) || (!!parent && matchesSearch(parent));

	function matchesSearch(field: Field | FieldNode) {
		return field.name.toLowerCase().includes(search.value.toLowerCase());
	}

	function matchesInNestedGroups(field: Field): boolean {
		const groupChildren = fieldsStore.getFieldGroupChildren(field.collection, field.field);

		if (groupChildren?.some(matchesInNestedGroups)) return true;

		const isRelationalFieldOfRootCollection =
			!isNil(field.schema?.foreign_key_table) && field.collection === props.collection;

		const relationalChildren = isRelationalFieldOfRootCollection
			? fieldsStore.getFieldsForCollection(field.schema!.foreign_key_table!)
			: null;

		return relationalChildren?.some((field) => matchesSearch(field)) || matchesSearch(field);
	}
}

// --- VFieldListItem.vue, flattened into rows ---
function supportedFunctions(field: FieldInfo): string[] {
	if (!props.includeFunctions || field.group || field._loading) return [];
	return getFunctionsForType(field.type);
}

/** Groups open while searching: a group whose parents are all groups (DR openWhileSearching + parentOpen). */
function groupPaths(nodes: FieldInfo[]): string[] {
	return nodes.filter((node) => node.group).flatMap((node) => [node.path, ...groupPaths(node.children ?? [])]);
}

const uid = useId();

const rows = computed<Row[]>(() => {
	const result: Row[] = [];

	if (props.allowSelectAll) {
		result.push({ kind: 'select-all', id: `${uid}-all`, level: 1, parent: null, nodes: treeList.value, root: true });
	}

	addNodes(treeList.value, 1, null);
	return result;

	function addNodes(nodes: FieldInfo[], level: number, parent: string | null) {
		for (const node of nodes) {
			const id = `${uid}-${node._loading ? `${parent}-loading` : node.path || node.field}`;
			const fns = supportedFunctions(node);
			const expandable = (!!node.children || fns.length > 0) && (props.depth === undefined || level - 1 < props.depth);

			result.push({ kind: 'field', id, level, parent, node, expandable });

			if (!expandable || !open.value.has(node.path)) continue;

			for (const fn of fns) {
				result.push({ kind: 'function', id: `${id}-fn-${fn}`, level: level + 1, parent: id, node, fn });
			}

			if (props.allowSelectAll && node.children) {
				result.push({
					kind: 'select-all',
					id: `${id}-all`,
					level: level + 1,
					parent: id,
					nodes: node.children,
					root: false,
				});
			}

			addNodes(node.children ?? [], level + 1, id);
		}
	}
});

function displayName(field: FieldInfo) {
	return props.rawFieldNames ? field.field : field.name || formatTitle(field.field);
}

/** The row emits `add` on activation (DR: clickable list item / list group activator). */
function selectable(row: Row): boolean {
	if (row.kind === 'select-all') {
		return row.root
			? !unref(treeList).every((field) => field.disabled === true)
			: !row.nodes.every((field) => field.disabled === true);
	}

	if (row.node._loading) return false;
	if (row.kind === 'function') return !row.node.disabled;
	if (!row.expandable) return !row.node.disabled;
	return !row.node.disabled && (props.relationalFieldSelectable || !row.node.relatedCollection);
}

function isOpen(row: Row) {
	return row.kind === 'field' && row.expandable && open.value.has(row.node.path);
}

function toggle(row: Row) {
	if (row.kind !== 'field' || !row.expandable) return;

	const next = new Set(open.value);

	if (next.has(row.node.path)) {
		next.delete(row.node.path);
	} else {
		next.add(row.node.path);
	}

	open.value = next;

	if (props.loadPathLevel) props.loadPathLevel(row.node.key);
	else loadFieldRelations(row.node.path);
}

function activate(row: Row) {
	if (!selectable(row)) {
		toggle(row);
		return;
	}

	if (row.kind === 'select-all') {
		emit(
			'add',
			row.root
				? row.nodes.filter((field) => field.type !== 'alias').map((field) => field.field)
				: row.nodes.map((f) => f.key),
		);
	} else if (row.kind === 'function') {
		emit('add', [`${row.fn}(${row.node.key})`]);
	} else {
		emit('add', [row.node.key]);
	}
}

// --- Keyboard (WAI-ARIA tree, layout-patterns §9) ---
const focusedId = ref<string | null>(null);
const tree = ref<HTMLElement>();

const tabStop = computed(() =>
	rows.value.some((row) => row.id === focusedId.value) ? focusedId.value : (rows.value[0]?.id ?? null),
);

function focusRow(index: number) {
	const row = rows.value[index];
	if (!row) return;
	focusedId.value = row.id;
	nextTick(() => tree.value?.querySelector<HTMLElement>(`[id="${CSS.escape(row.id)}"]`)?.focus());
}

function onKeydown(event: KeyboardEvent, index: number) {
	const row = rows.value[index]!;

	switch (event.key) {
		case 'ArrowDown':
			focusRow(index + 1);
			break;
		case 'ArrowUp':
			focusRow(index - 1);
			break;
		case 'Home':
			focusRow(0);
			break;
		case 'End':
			focusRow(rows.value.length - 1);
			break;
		case 'ArrowRight':
			if (row.kind !== 'field' || !row.expandable) return;
			if (isOpen(row)) focusRow(index + 1);
			else toggle(row);
			break;
		case 'ArrowLeft':
			if (isOpen(row)) toggle(row);
			else if (row.parent) focusRow(rows.value.findIndex((r) => r.id === row.parent));
			else return;
			break;
		case 'Enter':
		case ' ':
			activate(row);
			break;
		default:
			return;
	}

	event.preventDefault();
}

const ROW =
	'menu-dropdown-item menu-dropdown-item-inactive min-h-9 cursor-pointer gap-2 aria-disabled:cursor-not-allowed aria-disabled:text-gray-300 dark:aria-disabled:text-gray-700';
const TOGGLE =
	'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="flex min-w-[16.875rem] flex-col gap-2">
		<slot name="prepend" />

		<BoInput
			v-if="showSearch"
			v-model="search"
			type="search"
			autofocus
			:placeholder="$t('search')"
			:aria-label="$t('search')"
			@click.stop
		/>

		<ul ref="tree" role="tree" :aria-label="$t('field', 2)" class="max-h-80 overflow-auto">
			<li
				v-for="(row, index) in rows"
				:id="row.id"
				:key="row.id"
				role="treeitem"
				:aria-level="row.level"
				:aria-expanded="row.kind === 'field' && row.expandable ? isOpen(row) : undefined"
				:aria-disabled="!selectable(row) && !(row.kind === 'field' && row.expandable) ? 'true' : undefined"
				:tabindex="row.id === tabStop ? 0 : -1"
				:class="[ROW, { 'font-mono': rawFieldNames && row.kind === 'field' }]"
				:style="{ paddingInlineStart: `${0.5 + (row.level - 1)}rem` }"
				@click="activate(row)"
				@focus="focusedId = row.id"
				@keydown="onKeydown($event, index)"
			>
				<button
					v-if="row.kind === 'field' && row.expandable"
					type="button"
					tabindex="-1"
					:class="TOGGLE"
					:aria-label="`${$t(isOpen(row) ? 'collapse' : 'expand')} ${displayName(row.node)}`"
					@click.stop="toggle(row)"
				>
					<BoIcon
						name="chevron_right"
						size="sm"
						class="transition-transform motion-reduce:transition-none"
						:class="{ 'rotate-90': isOpen(row) }"
					/>
				</button>
				<span v-else class="size-6 shrink-0" />

				<template v-if="row.kind === 'select-all'">{{ $t('select_all') }}</template>

				<template v-else-if="row.kind === 'function'">
					<BoIcon name="auto_awesome" size="sm" class="text-brand-500 dark:text-brand-400" />
					<BoTextOverflow
						class="min-w-0 flex-1 text-brand-600 dark:text-brand-400"
						:text="`${$t(`functions.${row.fn}`)} (${displayName(row.node)})`"
					/>
				</template>

				<template v-else>
					<BoIcon
						v-if="row.node.field.startsWith('$')"
						name="auto_awesome"
						size="sm"
						class="text-brand-500 dark:text-brand-400"
					/>
					<BoTextOverflow class="min-w-0 flex-1" :text="displayName(row.node)" />
				</template>
			</li>
		</ul>

		<p
			v-if="search && treeList.length === 0"
			role="status"
			class="px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400"
		>
			{{ $t('no_results') }}
		</p>
	</div>
</template>
