<!-- Ported from directus/app/src/layouts/kanban/kanban.vue -->
<script setup lang="ts">
// Backoffice: recipe "Kanban board (Q-5)": the board scrolls horizontally inside the layout (the page does not, FR-116);
// v-menu -> Reka dropdown menus; the column menu also has "Move left" / "Move right" (keyboard path of the column drag,
// D-69) and shows for `choices` groups when they can be reordered; each card is focusable (Enter / Space opens it, as a
// table row) and has a menu "Move to group…" / "Move up" / "Move down" (keyboard path of the card drag, D-69) that
// calls the same `change` / `changeGroupSort` as a drag; deleting a group asks first (D-74: DR deletes at once);
// an "Add group" column (recipe Q-5) opens the add dialog that DR has without a button; the click handler and the
// selection get the item row (`element.item`) so a primary key other than `id` works.
import type { Field, PrimaryKey } from '@directus/types';
import {
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRoot,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from 'reka-ui';
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Draggable from 'vuedraggable';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoInput from '../../components/BoInput.vue';
import BoNotice from '../../components/BoNotice.vue';
import RenderDisplay from '../../components/render/RenderDisplay.vue';
import DisplayDatetime from '../../displays/datetime/DisplayDatetime.vue';
import DisplayLabels from '../../displays/labels/DisplayLabels.vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import type { ChangeEvent, Group, Item, LayoutOptions } from './types.ts';

defineOptions({ name: 'LayoutKanban', inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		collection?: string | null;
		itemCount: number | null;
		totalCount: number | null;
		isFiltered: boolean;
		limit: number;
		groupCollection?: string | null;
		fieldsInCollection?: Field[];
		primaryKeyField?: Record<string, any> | null;
		groupedItems?: Group[];
		groupTitle?: string | null;
		groupPrimaryKeyField?: Record<string, any> | null;
		change: (group: Group, event: ChangeEvent<Item>) => void | Promise<void>;
		changeGroupSort: (event: ChangeEvent<Group>) => void | Promise<void>;
		addGroup: (title: string) => Promise<void>;
		editGroup: (id: string | number, title: string) => Promise<void>;
		deleteGroup: (id: string | number) => Promise<void>;
		isRelational?: boolean;
		canReorderGroups: boolean;
		canReorderItems: boolean;
		canUpdateGroupTitle: boolean;
		canDeleteGroups: boolean;
		canCreateGroups?: boolean;
		sortField?: string | null;
		userField?: string | null;
		groupsSortField?: string | null;
		crop?: boolean;
		layoutOptions: LayoutOptions | null;
		resetPresetAndRefresh: () => Promise<void>;
		error?: any;
		selection: PrimaryKey[];
		selectMode?: boolean;
		onClick: (options: { item: Record<string, any>; event: MouseEvent }) => void;
	}>(),
	{
		collection: null,
		groupCollection: null,
		fieldsInCollection: () => [],
		primaryKeyField: null,
		groupedItems: () => [],
		groupTitle: null,
		groupPrimaryKeyField: null,
		isRelational: true,
		canCreateGroups: false,
		sortField: null,
		userField: null,
		groupsSortField: null,
		crop: true,
		error: null,
		selectMode: false,
	},
);

defineEmits(['update:selection', 'update:limit', 'update:size', 'update:sort', 'update:width']);

const { t, n } = useI18n();

const editDialogOpen = ref<string | number | null>(null);
const editTitle = ref('');
const deleteDialogOpen = ref<string | number | null>(null);
const announcement = ref('');

const atLimit = computed(() => {
	const count = (props.isFiltered ? props.itemCount : props.totalCount) ?? 0;
	return count > props.limit;
});

function openEditGroup(group: Group) {
	editDialogOpen.value = group.id;
	editTitle.value = group.title;
}

function openAddGroup() {
	editDialogOpen.value = '+';
	editTitle.value = '';
}

function parseAvatar(file: Record<string, any>) {
	if (!file || !file['type']) return;
	if (file['type'].startsWith('image') === false) return;

	return getAssetUrl(file['id'], {
		imageKey: 'system-small-cover',
		cacheBuster: file['modified_on'],
	});
}

function cancelChanges() {
	editDialogOpen.value = null;
	editTitle.value = '';
}

function saveChanges() {
	if (editDialogOpen.value === '+') {
		props.addGroup(editTitle.value);
	} else if (editDialogOpen.value) {
		props.editGroup(editDialogOpen.value, editTitle.value);
	}

	editDialogOpen.value = null;
	editTitle.value = '';
}

function confirmDelete() {
	const id = deleteDialogOpen.value;
	deleteDialogOpen.value = null;
	if (id !== null) props.deleteGroup(id);
}

const fieldDisplay = computed(() => {
	return {
		titleField: getRenderDisplayOptions('titleField'),
		textField: getRenderDisplayOptions('textField'),
		dateField: getRenderDisplayOptions('dateField'),
	};

	function getRenderDisplayOptions(fieldName: keyof LayoutOptions) {
		const fieldConfiguration = props.fieldsInCollection.find(
			(field) => field.field === props.layoutOptions?.[fieldName],
		);

		if (!fieldConfiguration) return;
		const { field, type, meta } = fieldConfiguration;
		return {
			collection: props.collection ?? '',
			field,
			type,
			display: meta?.display ?? null,
			options: meta?.display_options,
			interface: meta?.interface,
			interfaceOptions: meta?.options,
		};
	}
});

const reorderGroupsDisabled = computed(() => !props.canReorderGroups || props.selectMode);
const reorderItemsDisabled = computed(() => !props.canReorderItems || props.selectMode);

function pkOf(element: Item): PrimaryKey {
	return element.item[props.primaryKeyField?.['field'] ?? 'id'] ?? element.id;
}

function groupTitleOf(group: Group) {
	return group.id === null ? t('layouts.kanban.no_group') : group.title;
}

function cardLabel(element: Item) {
	return typeof element.title === 'string' && element.title ? element.title : String(element.id);
}

// table-row.vue onKeydown: Enter / Space on the card itself (not on its menu button) opens or selects it.
function onCardKeydown(element: Item, event: KeyboardEvent) {
	if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
	event.preventDefault();
	props.onClick({ item: element.item, event: event as unknown as MouseEvent });
}

/* ------------------------------------------------------------------ keyboard path of the drags (D-69) */

const boardElement = ref<HTMLElement>();

async function focusCard(id: string | number) {
	await nextTick();
	boardElement.value?.querySelector<HTMLElement>(`[data-card="${CSS.escape(String(id))}"]`)?.focus();
}

async function moveCard(group: Group, index: number, offset: -1 | 1) {
	const element = group.items[index]!;
	await props.change(group, { moved: { element, oldIndex: index, newIndex: index + offset } });
	announcement.value = t('moved_to_position', {
		item: cardLabel(element),
		position: index + offset + 1,
		total: group.items.length,
	});
}

async function moveCardToGroup(element: Item, target: Group) {
	await props.change(target, { added: { element, newIndex: target.items.length } });
	await focusCard(element.id);
}

function moveGroup(index: number, offset: -1 | 1) {
	props.changeGroupSort({
		moved: { element: props.groupedItems[index]!, oldIndex: index, newIndex: index + offset },
	});
}

function canMoveGroup(index: number, offset: -1 | 1) {
	const target = props.groupedItems[index + offset];
	return target !== undefined && target.id !== null;
}

const ICON_BTN =
	'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const MENU =
	'z-99999 min-w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark';
const ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
const DANGER =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-error-600 outline-hidden data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-error-50 dark:text-error-400 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-error-500/15';
const ITEM_ICON = 'text-gray-500 dark:text-gray-400';
const SEPARATOR = 'my-1 border-t border-gray-200 dark:border-gray-800';
</script>

<template>
	<div class="flex h-full w-full min-w-0 flex-col">
		<slot v-if="error" name="error" :error="error" :reset="resetPresetAndRefresh" />

		<template v-else>
			<BoNotice v-if="atLimit" type="warning" class="mb-4">
				{{ $t('dataset_too_large_currently_showing_n_items', { n: n(props.limit ?? 0) }) }}
			</BoNotice>

			<div ref="boardElement" class="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4 custom-scrollbar">
				<Draggable
					:model-value="groupedItems"
					group="groups"
					item-key="id"
					draggable=".draggable"
					:disabled="reorderGroupsDisabled"
					:animation="150"
					ghost-class="opacity-50"
					class="flex gap-4"
					@change="changeGroupSort"
				>
					<template #item="{ element: group, index: groupIndex }">
						<section
							class="flex w-72 shrink-0 flex-col rounded-2xl bg-gray-50 dark:bg-white/[0.03]"
							:class="{ draggable: group.id !== null, 'cursor-move': group.id !== null && !reorderGroupsDisabled }"
							:aria-label="groupTitleOf(group)"
						>
							<div class="flex items-center gap-2 px-3 py-2">
								<h3 class="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
									{{ groupTitleOf(group) }}
								</h3>
								<span
									class="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700 dark:bg-white/5 dark:text-white/80"
								>
									{{ group.items.length }}
								</span>
								<DropdownMenuRoot v-if="group.id !== null && !selectMode && (isRelational || !reorderGroupsDisabled)">
									<DropdownMenuTrigger as-child>
										<button
											type="button"
											class="group-menu ms-auto"
											:class="ICON_BTN"
											:aria-label="$t('item_options', { item: groupTitleOf(group) })"
										>
											<BoIcon name="more_horiz" size="sm" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuPortal>
										<DropdownMenuContent align="end" :side-offset="4" :class="MENU">
											<template v-if="isRelational">
												<DropdownMenuItem
													:disabled="!canUpdateGroupTitle || selectMode"
													:class="ITEM"
													@select="openEditGroup(group)"
												>
													<BoIcon name="edit" size="sm" :class="ITEM_ICON" />
													{{ $t('layouts.kanban.edit_group') }}
												</DropdownMenuItem>
												<DropdownMenuItem
													:disabled="!canDeleteGroups || selectMode"
													:class="DANGER"
													@select="deleteDialogOpen = group.id"
												>
													<BoIcon name="delete" size="sm" />
													{{ $t('layouts.kanban.delete_group') }}
												</DropdownMenuItem>
											</template>
											<template v-if="!reorderGroupsDisabled">
												<DropdownMenuSeparator v-if="isRelational" :class="SEPARATOR" />
												<DropdownMenuItem
													:disabled="!canMoveGroup(groupIndex, -1)"
													:class="ITEM"
													@select="moveGroup(groupIndex, -1)"
												>
													<BoIcon name="arrow_back" size="sm" :class="ITEM_ICON" />
													{{ $t('move_left') }}
												</DropdownMenuItem>
												<DropdownMenuItem
													:disabled="!canMoveGroup(groupIndex, 1)"
													:class="ITEM"
													@select="moveGroup(groupIndex, 1)"
												>
													<BoIcon name="arrow_forward" size="sm" :class="ITEM_ICON" />
													{{ $t('move_right') }}
												</DropdownMenuItem>
											</template>
										</DropdownMenuContent>
									</DropdownMenuPortal>
								</DropdownMenuRoot>
							</div>

							<Draggable
								:model-value="group.items"
								group="items"
								draggable=".item"
								:disabled="reorderItemsDisabled"
								:animation="150"
								:sort="sortField !== null"
								ghost-class="opacity-50"
								class="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 custom-scrollbar"
								item-key="id"
								@change="change(group, $event)"
							>
								<template #item="{ element, index }">
									<div
										class="item group/card relative cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:focus-visible:outline-brand-400"
										:class="{ 'ring-2 ring-brand-500 dark:ring-brand-400': selection.includes(pkOf(element)) }"
										:data-card="element.id"
										tabindex="0"
										@click="onClick({ item: element.item, event: $event })"
										@keydown="onCardKeydown(element, $event)"
									>
										<DropdownMenuRoot v-if="!reorderItemsDisabled">
											<DropdownMenuTrigger as-child>
												<button
													type="button"
													class="card-menu absolute end-2 top-2 bg-white opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 dark:bg-gray-900"
													:class="ICON_BTN"
													:aria-label="$t('item_options', { item: cardLabel(element) })"
													@click.stop
												>
													<BoIcon name="more_vert" size="sm" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuPortal>
												<DropdownMenuContent align="end" :side-offset="4" :class="MENU">
													<DropdownMenuSub>
														<DropdownMenuSubTrigger :class="ITEM">
															<BoIcon name="swap_horiz" size="sm" :class="ITEM_ICON" />
															{{ $t('move_to_group') }}
															<BoIcon name="chevron_right" size="sm" class="ms-auto" :class="ITEM_ICON" />
														</DropdownMenuSubTrigger>
														<DropdownMenuPortal>
															<DropdownMenuSubContent
																:side-offset="4"
																:class="MENU"
																:aria-label="$t('move_item_to_group', { item: cardLabel(element) })"
															>
																<DropdownMenuItem
																	v-for="target in groupedItems.filter((other) => other !== group)"
																	:key="String(target.id)"
																	:class="ITEM"
																	@select="moveCardToGroup(element, target)"
																>
																	{{ groupTitleOf(target) }}
																</DropdownMenuItem>
															</DropdownMenuSubContent>
														</DropdownMenuPortal>
													</DropdownMenuSub>
													<template v-if="sortField !== null">
														<DropdownMenuItem
															:disabled="index === 0"
															:class="ITEM"
															@select="moveCard(group, index, -1)"
														>
															<BoIcon name="arrow_upward" size="sm" :class="ITEM_ICON" />
															{{ $t('move_up') }}
														</DropdownMenuItem>
														<DropdownMenuItem
															:disabled="index === group.items.length - 1"
															:class="ITEM"
															@select="moveCard(group, index, 1)"
														>
															<BoIcon name="arrow_downward" size="sm" :class="ITEM_ICON" />
															{{ $t('move_down') }}
														</DropdownMenuItem>
													</template>
												</DropdownMenuContent>
											</DropdownMenuPortal>
										</DropdownMenuRoot>

										<div
											v-if="element.title"
											class="title mb-1 pe-8 text-theme-sm font-medium text-gray-800 dark:text-white/90"
										>
											<RenderDisplay
												v-if="fieldDisplay.titleField"
												v-bind="fieldDisplay.titleField"
												:value="element.title"
											/>
										</div>
										<img
											v-if="element.image"
											class="mt-1 w-full rounded-lg"
											:class="crop ? 'aspect-[5/3] object-cover' : 'max-h-64 object-contain'"
											:src="element.image"
											alt=""
											draggable="false"
										/>
										<div
											v-if="element.text"
											class="text mt-1 line-clamp-3 text-theme-xs text-gray-500 dark:text-gray-400"
										>
											<RenderDisplay
												v-if="fieldDisplay.textField"
												v-bind="fieldDisplay.textField"
												:value="element.text"
											/>
										</div>
										<DisplayLabels
											v-if="element.tags"
											class="mt-2 flex flex-wrap gap-1"
											:value="element.tags"
											:type="Array.isArray(element.tags) ? 'csv' : 'json'"
										/>
										<div class="mt-2 flex items-center justify-between gap-2">
											<span class="text-theme-xs text-gray-500 dark:text-gray-400">
												<DisplayDatetime
													v-if="element.date"
													v-bind="
														fieldDisplay.dateField?.display === 'datetime'
															? fieldDisplay.dateField.options
															: { format: 'short' }
													"
													:value="element.date"
													:type="element.dateType"
												/>
											</span>
											<div class="flex items-center -space-x-2">
												<span
													v-for="user in element.users.slice(0, 3)"
													:key="user.id"
													class="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gray-100 text-gray-500 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-400"
													:title="`${user.first_name} ${user.last_name}`"
												>
													<img
														v-if="user.avatar && parseAvatar(user.avatar as any)"
														class="h-full w-full object-cover"
														:src="parseAvatar(user.avatar as any)"
														:alt="`${user.first_name} ${user.last_name}`"
													/>
													<BoIcon v-else name="person" size="sm" :label="`${user.first_name} ${user.last_name}`" />
												</span>
												<span
													v-if="element.users.length > 3"
													class="ps-3 text-theme-xs text-gray-500 dark:text-gray-400"
												>
													+{{ element.users.length - 3 }}
												</span>
											</div>
										</div>
									</div>
								</template>
							</Draggable>
						</section>
					</template>
				</Draggable>

				<div
					v-if="isRelational && canCreateGroups && !selectMode"
					class="flex w-72 shrink-0 items-start justify-center rounded-2xl border-2 border-dashed border-gray-200 p-3 dark:border-gray-800"
				>
					<BoButton variant="secondary" icon="add" @click="openAddGroup">{{ $t('layouts.kanban.add_group') }}</BoButton>
				</div>
			</div>

			<span class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</span>

			<BoDialog
				:open="editDialogOpen !== null"
				:title="editDialogOpen === '+' ? $t('layouts.kanban.add_group') : $t('layouts.kanban.edit_group')"
				@update:open="!$event && cancelChanges()"
			>
				<form id="kanban-group-form" @submit.prevent="saveChanges">
					<BoInput
						v-model="editTitle"
						:label="$t('layouts.kanban.group_title')"
						:placeholder="$t('layouts.kanban.add_group_placeholder')"
					/>
				</form>
				<template #actions>
					<BoButton variant="secondary" @click="cancelChanges()">{{ $t('cancel') }}</BoButton>
					<BoButton type="submit" form="kanban-group-form">
						{{ editDialogOpen === '+' ? $t('create') : $t('save') }}
					</BoButton>
				</template>
			</BoDialog>

			<BoDialog
				:open="deleteDialogOpen !== null"
				:title="$t('delete_are_you_sure')"
				@update:open="!$event && (deleteDialogOpen = null)"
			>
				<template #actions>
					<BoButton variant="secondary" @click="deleteDialogOpen = null">{{ $t('cancel') }}</BoButton>
					<BoButton variant="danger" @click="confirmDelete">{{ $t('delete_label') }}</BoButton>
				</template>
			</BoDialog>
		</template>
	</div>
</template>
