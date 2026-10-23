<!-- Ported from directus/app/src/interfaces/_system/system-permissions/permissions-row.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-23): the collection key in `font-mono` with the display name as `title` (DR tooltip), the
// all / none shortcuts as text buttons, the remove icon as a named icon button.
import type { Permission, PermissionsAction } from '@directus/types';
import BoButton from '../../../components/BoButton.vue';
import ValueNull from '../../../components/render/ValueNull.vue';
import type { Collection } from '../../../stores/collections.ts';
import { displayCollectionKey } from '../../../utils/display-collection-key.ts';
import { editablePermissionActions, type EditablePermissionsAction } from './app-permissions.ts';
import PermissionsToggle from './PermissionsToggle.vue';

defineProps<{
	collection: Collection;
	disabledActions?: EditablePermissionsAction[] | undefined;
	permissions: Permission[];
	appMinimal?: Partial<Permission>[] | undefined;
}>();

const emit = defineEmits<{
	editItem: [action: PermissionsAction];
	removeRow: [];
	setFullAccess: [action: PermissionsAction];
	setNoAccess: [action: PermissionsAction];
	setFullAccessAll: [];
	setNoAccessAll: [];
}>();

const TD = 'border-t border-gray-100 py-2 align-middle dark:border-gray-800';
const SHORTCUT =
	'cursor-pointer rounded text-theme-xs text-gray-500 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-brand-400 dark:focus-visible:outline-brand-400';
</script>

<template>
	<tr class="permissions-row" :data-collection="collection.collection">
		<th scope="row" class="collection ps-3 pe-2 text-start font-normal" :class="TD">
			<div class="flex flex-col gap-0.5">
				<span class="name font-mono text-gray-800 dark:text-white/90" :title="collection.name">
					{{ displayCollectionKey(collection.collection) }}
				</span>
				<span class="shortcuts flex items-center gap-1">
					<button type="button" class="all" :class="SHORTCUT" @click="emit('setFullAccessAll')">{{ $t('all') }}</button>
					<span class="divider text-theme-xs text-gray-400" aria-hidden="true">/</span>
					<button type="button" class="none" :class="SHORTCUT" @click="emit('setNoAccessAll')">
						{{ $t('none') }}
					</button>
				</span>
			</div>
		</th>

		<td v-for="action in editablePermissionActions" :key="action" class="action px-1" :class="TD">
			<PermissionsToggle
				v-if="!disabledActions?.includes(action)"
				:action="action"
				:collection="collection"
				:permission="permissions.find((permission) => permission.action === action)"
				:app-minimal="appMinimal && appMinimal.find((permission) => permission.action === action)"
				@edit="emit('editItem', action)"
				@set-full-access="emit('setFullAccess', action)"
				@set-no-access="emit('setNoAccess', action)"
			/>
			<ValueNull v-else />
		</td>
		<td class="remove w-10 pe-1 text-end" :class="TD">
			<BoButton
				variant="ghost"
				icon="close"
				:aria-label="`${$t('remove')} ${collection.collection}`"
				:title="$t('remove')"
				@click="emit('removeRow')"
			/>
		</td>
	</tr>
</template>
