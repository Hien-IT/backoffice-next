<!-- Ported from directus/app/src/modules/users/components/navigation.vue; Ported from directus/app/src/modules/users/components/NavigationRole.vue -->
<script setup lang="ts">
// Backoffice: recipe layout-patterns §11 (Q-17), like the folder tree of FilesNavigation: the four status links, a
// divider, then the role tree. NavigationRole.vue's recursion is flattened into rows with `aria-level`, walked with the
// WAI-ARIA tree keyboard (use-tree-keyboard); open roles are the shared `openRoles` of useNavigation. Admins get the
// "edit role" menu (D-85) on right click (one Reka ContextMenu on the tree) and on a row menu button for the keyboard;
// it goes to /settings/roles/:id (the 012 frame until 016).
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';
import { computed, ref, toRefs, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BoIcon from '../../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import BoTextOverflow from '../../../components/BoTextOverflow.vue';
import { type TreeRow, useTreeKeyboard } from '../../../composables/use-tree-keyboard.ts';
import { useUserStore } from '../../../stores/user.ts';
import { translate } from '../../../utils/translate-object-values.ts';
import useNavigation, { type BasicRole } from '../composables/use-navigation.ts';

type Row = TreeRow & { level: number; role: BasicRole; name: string };

const props = defineProps<{
	currentRole?: string | undefined;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const { currentRole } = toRefs(props);

const { roles, roleTree, openRoles, loading } = useNavigation(currentRole);

const tree = useTemplateRef<HTMLElement>('tree');

const statuses = [
	{ name: 'users-active', icon: 'group', text: 'active_users' },
	{ name: 'users-suspended', icon: 'group_off', text: 'suspended_users' },
	{ name: 'users-invited', icon: 'person_add', text: 'invited_users' },
	{ name: 'users-all', icon: 'folder_shared', text: 'all_users' },
];

const rows = computed<Row[]>(() => {
	const result: Row[] = [];
	walk(roleTree.value, null, 1);
	return result;

	function walk(list: BasicRole[], parent: string | null, level: number) {
		for (const role of list) {
			const children = role.children ?? [];

			result.push({
				key: role.id,
				parent,
				children: children.map((child) => child.id),
				level,
				role,
				name: translate(role.name),
			});

			if (isOpen(role.id)) walk(children, role.id, level + 1);
		}
	}
});

const activeKey = computed(() => props.currentRole ?? null);

const { tabStop, onKeydown, onFocusin } = useTreeKeyboard({ rows, isOpen, toggle, activeKey, tree });

function isOpen(key: string) {
	return openRoles.value.includes(key);
}

function toggle(key: string) {
	openRoles.value = isOpen(key) ? openRoles.value.filter((item) => item !== key) : [...openRoles.value, key];
}

function settingLink(role: BasicRole) {
	return `/settings/roles/${role.id}`;
}

function menuItems(role: BasicRole): BoMenuItem[] {
	return [{ text: t('edit_role'), icon: 'list_alt', to: settingLink(role) }];
}

const menuRole = ref<BasicRole | null>(null);

// Capture phase: picks the role of the row before the Reka trigger opens; no role (or not admin) keeps the browser menu.
function onContextMenu(event: MouseEvent) {
	const key = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset['key'];
	menuRole.value = rows.value.find((row) => row.key === key)?.role ?? null;

	if (menuRole.value === null || !userStore.isAdmin) event.stopPropagation();
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

const ROW =
	'menu-dropdown-item min-h-9 gap-2 py-1 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 dark:has-focus-visible:outline-brand-400';

const MENU_ITEM =
	'flex w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-start text-theme-sm font-medium text-gray-700 no-underline outline-hidden data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-800 dark:text-gray-400 dark:data-[highlighted]:bg-white/5 dark:data-[highlighted]:text-gray-300';
</script>

<template>
	<nav class="flex flex-col" :aria-label="$t('user_directory')" @contextmenu.capture="onContextMenu">
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			<li v-for="item in statuses" :key="item.name">
				<RouterLink
					:to="{ name: item.name }"
					class="w-full no-underline"
					:class="[ROW, FOCUS, route.name === item.name ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive']"
					:aria-current="route.name === item.name ? 'page' : undefined"
				>
					<BoIcon :name="item.icon" size="sm" class="shrink-0" />
					<BoTextOverflow :text="$t(item.text)" />
				</RouterLink>
			</li>
		</ul>

		<div v-if="(roles && roles.length > 0) || loading" class="my-2 h-px bg-gray-200 dark:bg-gray-800" role="separator" />

		<div v-if="loading" class="space-y-1" aria-busy="true">
			<div
				v-for="n in 4"
				:key="n"
				class="h-9 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"
			/>
		</div>

		<ContextMenuRoot v-else-if="rows.length > 0">
			<ContextMenuTrigger as-child>
				<ul
					ref="tree"
					role="tree"
					:aria-label="$t('roles')"
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

							<RouterLink
								:to="{ name: 'roles-collection', params: { role: row.key } }"
								data-tree-row
								:tabindex="tabStop === row.key ? 0 : -1"
								:aria-current="activeKey === row.key ? 'page' : undefined"
								class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 no-underline outline-hidden after:absolute after:inset-0 after:rounded-lg"
							>
								<BoIcon :name="row.role.icon || 'supervised_user_circle'" size="sm" class="shrink-0" />
								<BoTextOverflow :text="row.name" />
							</RouterLink>

							<BoMenu v-if="userStore.isAdmin" :items="menuItems(row.role)" align="end">
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
					<ContextMenuItem v-if="menuRole" :class="MENU_ITEM" @select="router.push(settingLink(menuRole))">
						<BoIcon name="list_alt" size="sm" class="text-gray-500 dark:text-gray-400" />
						{{ $t('edit_role') }}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenuRoot>
	</nav>
</template>
