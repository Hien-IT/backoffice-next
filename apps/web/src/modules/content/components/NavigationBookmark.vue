<!-- Ported from directus/app/src/modules/content/components/navigation-bookmark.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §9, a bookmark is a child row of its collection in the tree; the active state is
// the DR `query` match of v-list-item (same collection and `?bookmark=<id>`), computed by ContentNavigation.
// The row menu is BoMenu (the button follows the row's roving tabindex so Tab reaches it); without permission a `lock`
// icon carries the `cannot_edit_<scope>_bookmarks` tooltip, also as its accessible name. The dialogs are BoDialogs
// (Esc and outside click cancel, Enter applies, the delete text is the dialog description and Cancel comes first,
// FR-115d). Role and global bookmarks are edited in Settings (`/settings/presets/:id`).
// Deleting the open bookmark routes to the collection and focuses the page title (FR-115c).
import { computed, inject, nextTick, reactive, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import InterfaceSystemInputTranslatedString from '../../../interfaces/_system/system-input-translated-string/InputTranslatedString.vue';
import InterfaceSelectColor from '../../../interfaces/select-color/SelectColor.vue';
import InterfaceSelectIcon from '../../../interfaces/select-icon/SelectIcon.vue';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useUserStore } from '../../../stores/user.ts';
import { getCollectionRoute } from '../../../utils/get-item-route.ts';
import { translateString } from '../../../utils/translate-object-values.ts';
import { unexpectedError } from '../../../utils/unexpected-error.ts';
import { navigationContextKey, type NavigationNode } from '../composables/use-navigation.ts';
import NavigationItemContent from './NavigationItemContent.vue';

const { node } = defineProps<{ node: NavigationNode }>();

const nav = inject(navigationContextKey)!;

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const userStore = useUserStore();
const presetsStore = usePresetsStore();

const bookmark = computed(() => node.bookmark!);
// DR translates the whole name (translate-literal); the regex of `translate` cuts a `$t:` key at `_`.
const name = computed(() => translateString(bookmark.value.bookmark ?? ''));
const active = computed(() => nav.isActive(node));

const isMine = computed(
	() => !!userStore.currentUser && 'id' in userStore.currentUser && bookmark.value.user === userStore.currentUser.id,
);

const hasPermission = computed(() => isMine.value || userStore.isAdmin);

const scope = computed(() => {
	if (bookmark.value.user && !bookmark.value.role) return 'personal';
	if (!bookmark.value.user && bookmark.value.role) return 'role';
	return 'global';
});

const { editActive, editValue, editSave, editSaving, editCancel, isEditDisabled } = useEditBookmark();
const { deleteActive, deleteSave, deleteSaving } = useDeleteBookmark();

const editFormId = useId();

const menuItems = computed<BoMenuItem[]>(() => [
	scope.value === 'personal'
		? { text: t(`edit_${scope.value}_bookmark`), icon: 'edit', onSelect: () => (editActive.value = true) }
		: { text: t(`edit_${scope.value}_bookmark`), icon: 'edit', to: `/settings/presets/${bookmark.value.id}` },
	{ text: t(`delete_${scope.value}_bookmark`), icon: 'delete', onSelect: () => (deleteActive.value = true) },
]);

function useEditBookmark() {
	const editActive = ref(false);

	const editValue = reactive({
		name: bookmark.value.bookmark,
		icon: bookmark.value?.icon ?? 'bookmark',
		color: bookmark.value?.color ?? null,
	});

	const editSaving = ref(false);

	const isEditDisabled = computed(() => editValue.name === null);

	return { editActive, editValue, editSave, editSaving, editCancel, isEditDisabled };

	async function editSave() {
		if (isEditDisabled.value || editSaving.value) return;

		editSaving.value = true;

		try {
			// Own bookmark: savePreset ends in presetsStore.update (PATCH /presets/:id), same payload as DR.
			await presetsStore.savePreset({
				...bookmark.value,
				bookmark: editValue.name,
				icon: editValue.icon,
				color: editValue.color,
			});

			editActive.value = false;
		} catch (error) {
			unexpectedError(error);
		} finally {
			editSaving.value = false;
		}
	}

	function editCancel() {
		editActive.value = false;
		editValue.name = bookmark.value.bookmark;
		editValue.icon = bookmark.value?.icon ?? 'bookmark';
		editValue.color = bookmark.value?.color ?? null;
	}
}

function useDeleteBookmark() {
	const deleteActive = ref(false);
	const deleteSaving = ref(false);

	return { deleteActive, deleteSave, deleteSaving };

	async function deleteSave() {
		if (deleteSaving.value) return;

		deleteSaving.value = true;

		try {
			let navigateTo: string | null = null;

			if (route.query?.['bookmark'] && +route.query['bookmark'] === bookmark.value.id) {
				navigateTo = getCollectionRoute(bookmark.value.collection);
			}

			await presetsStore.delete([bookmark.value.id!]);
			deleteActive.value = false;

			if (navigateTo) {
				await router.replace(navigateTo);
				await focusPageTitle();
			}
		} catch (error) {
			unexpectedError(error);
		} finally {
			deleteSaving.value = false;
		}
	}
}

// Backoffice: FR-115c. After the closing dialog has returned focus (its focus scope restores on a timeout).
async function focusPageTitle() {
	await nextTick();

	setTimeout(() => {
		const title = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
		if (!title) return;
		title.setAttribute('tabindex', '-1');
		title.focus();
	});
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<li role="treeitem" :data-key="node.key" :aria-level="node.level" :aria-selected="active">
		<div
			class="group menu-dropdown-item gap-2 py-1 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 dark:has-focus-visible:outline-brand-400"
			:class="[
				active ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive',
				nav.dense.value ? 'min-h-8 text-theme-sm' : 'min-h-9 text-sm',
			]"
		>
			<RouterLink
				:to="`${getCollectionRoute(bookmark.collection)}?bookmark=${bookmark.id}`"
				data-nav-row
				:tabindex="nav.tabStop.value === node.key ? 0 : -1"
				:aria-current="active ? 'page' : undefined"
				class="flex min-w-0 flex-1 items-center gap-2 no-underline outline-hidden after:absolute after:inset-0 after:rounded-lg"
			>
				<NavigationItemContent :name="name" :icon="bookmark.icon ?? 'bookmark'" :color="bookmark.color" />
			</RouterLink>

			<BoMenu v-if="hasPermission" :items="menuItems" align="end">
				<template #trigger>
					<button
						type="button"
						class="ctx-toggle relative z-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
						:class="FOCUS"
						:tabindex="nav.tabStop.value === node.key ? 0 : -1"
						:aria-label="$t('item_options', { item: name })"
						@keydown.down.stop
					>
						<BoIcon name="more_vert" size="sm" />
					</button>
				</template>
			</BoMenu>
			<BoTooltip v-else :text="$t(`cannot_edit_${scope}_bookmarks`)" side="bottom">
				<span
					class="ctx-toggle relative z-1 flex size-7 shrink-0 items-center justify-center"
					role="img"
					:aria-label="$t(`cannot_edit_${scope}_bookmarks`)"
				>
					<BoIcon name="lock" size="sm" />
				</span>
			</BoTooltip>
		</div>

		<BoDialog
			:open="editActive"
			:title="$t('edit_personal_bookmark')"
			@update:open="$event ? (editActive = true) : editCancel()"
		>
			<form :id="editFormId" class="fields grid grid-cols-2 gap-4" @submit.prevent="editSave">
				<InterfaceSystemInputTranslatedString
					:value="editValue.name"
					class="full col-span-2"
					autofocus
					@input="editValue.name = $event"
				/>
				<InterfaceSelectIcon width="half" :value="editValue.icon" @input="editValue.icon = $event" />
				<InterfaceSelectColor width="half" :value="editValue.color" @input="editValue.color = $event" />
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="editCancel">{{ $t('cancel') }}</BoButton>
				<BoButton type="submit" :form="editFormId" :disabled="isEditDisabled" :loading="editSaving">
					{{ $t('save') }}
				</BoButton>
			</template>
		</BoDialog>

		<BoDialog
			:open="deleteActive"
			:title="$t(`delete_${scope}_bookmark`)"
			:description="$t('delete_bookmark_copy', { bookmark: bookmark.bookmark })"
			@update:open="deleteActive = $event"
		>
			<template #actions>
				<BoButton variant="secondary" @click="deleteActive = false">{{ $t('cancel') }}</BoButton>
				<BoButton :loading="deleteSaving" variant="danger" @click="deleteSave">
					{{ $t('delete_label') }}
				</BoButton>
			</template>
		</BoDialog>
	</li>
</template>
