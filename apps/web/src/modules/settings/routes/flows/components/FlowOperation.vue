<!-- Ported from directus/app/src/modules/settings/routes/flows/components/operation.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-022, FR-023, FR-026, recipe Q-30): VWorkspaceTile is BoWorkspaceTile; the resolve, reject and
// input handles are buttons with a 32 px hit area centred on the Directus attachment points; colours from the theme
// (resolve brand, reject orange, subdued gray); VSelect is BoSelect; VErrorBoundary is onErrorCaptured. The arrow drag
// is pointer only, as Directus (recorded a11y exception, FR-106); no RTL mirroring. The workspace is found by its
// `data-workspace` attribute instead of the `.workspace` class.
import type { FlowRaw } from '@directus/types';
import { computed, onErrorCaptured, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoSelect from '../../../../../components/BoSelect.vue';
import BoWorkspaceTile, { type TilePosition } from '../../../../../components/workspace/BoWorkspaceTile.vue';
import { getOperation } from '../../../../../operations/index.ts';
import { Vector2 } from '../../../../../utils/vector2.ts';
import { ATTACHMENT_OFFSET, GRID_SIZE, REJECT_OFFSET, RESOLVE_OFFSET } from '../constants.ts';
import { getTriggers } from '../triggers.ts';
import type { ArrowInfo, Target } from '../types.ts';
import OptionsOverview from './OptionsOverview.vue';

const props = withDefaults(
	defineProps<{
		panel: Record<string, any>;
		type?: 'trigger' | 'operation';
		editMode?: boolean;
		parent?: { id: string; type: Target; loner: boolean } | undefined;
		flow: FlowRaw;
		panelsToBeDeleted: string[];
		isHovered?: boolean;
		subdued?: boolean;
	}>(),
	{
		type: 'operation',
		editMode: false,
		parent: undefined,
		isHovered: false,
		subdued: false,
	},
);

const { panelsToBeDeleted } = toRefs(props);

const { t } = useI18n();
const { triggers } = getTriggers();

const emit = defineEmits<{
	create: [id: string, type: Target];
	edit: [panel: Record<string, any>];
	update: [event: { edits: TilePosition; id: string }];
	delete: [id: string];
	move: [id: string];
	duplicate: [panel: Record<string, any>];
	'arrow-move': [info: ArrowInfo];
	'arrow-stop': [];
	'show-hint': [id: string];
	'hide-hint': [];
	'flow-status': [status: string];
}>();

const currentOperation = computed(() => {
	if (props.type === 'operation') return getOperation(props.panel['type']);
	else return triggers.find((trigger) => trigger.id === props.panel['type']);
});

let down: Target | 'parent' | undefined = undefined;
let rafId: number | null = null;
const moving = ref(false);
let workspaceOffset: Vector2 = new Vector2(0, 0);

const isReject = computed(() => props.parent?.type === 'reject');
const isSubdued = computed(
	() => props.subdued || ((props.parent === undefined || props.parent.loner) && props.type === 'operation'),
);

function pointerdown(target: Target | 'parent') {
	if (!props.editMode || (target === 'parent' && props.parent === undefined)) return;

	down = target;

	const rect = document.querySelector('[data-workspace]')?.getBoundingClientRect();

	if (rect) {
		// Backoffice: pageX/pageY minus the page-relative workspace position (Directus reads `rect` the same way).
		workspaceOffset = new Vector2(rect.left + window.scrollX, rect.top + window.scrollY);
	}

	window.addEventListener('pointermove', pointermove);
	window.addEventListener('pointerup', pointerup);
}

const pointermove = (event: PointerEvent) => {
	rafId = window.requestAnimationFrame(() => {
		moving.value = true;
		if (!down) return;

		const xPos = Math.round((event.pageX - workspaceOffset.x) / GRID_SIZE) * GRID_SIZE;
		const yPos = Math.round((event.pageY - workspaceOffset.y) / GRID_SIZE) * GRID_SIZE;

		let arrowInfo: ArrowInfo;

		if (down === 'parent') {
			arrowInfo = {
				id: props.parent!.id,
				type: props.parent!.type as Target,
				pos: new Vector2(xPos, yPos),
			};
		} else {
			arrowInfo = {
				id: props.panel['id'],
				type: down,
				pos: new Vector2(xPos, yPos),
			};
		}

		emit('arrow-move', arrowInfo);
	});
};

function pointerup() {
	if (
		!moving.value &&
		((down === 'reject' && (!props.panel['reject'] || panelsToBeDeleted.value.includes(props.panel['reject']))) ||
			(down === 'resolve' && (!props.panel['resolve'] || panelsToBeDeleted.value.includes(props.panel['resolve']))))
	) {
		emit('create', props.panel['id'], down);
	}

	moving.value = false;
	down = undefined;
	if (rafId) window.cancelAnimationFrame(rafId);

	emit('arrow-stop');

	window.removeEventListener('pointermove', pointermove);
	window.removeEventListener('pointerup', pointerup);
}

const flowStatus = computed({
	get() {
		return props.flow.status;
	},
	set(newVal: string) {
		emit('flow-status', newVal);
	},
});

/* show hint buttons */
function pointerEnter() {
	if (!props.editMode) return;
	emit('show-hint', props.panel['id']);
}

function pointerLeave() {
	if (!props.editMode) return;
	emit('hide-hint');
}

const overviewError = ref(false);

onErrorCaptured(() => {
	overviewError.value = true;
	return false;
});

const at = (offset: Vector2) => ({ insetInlineStart: `${offset.x}px`, insetBlockStart: `${offset.y}px` });

const HANDLE =
	'absolute z-10 inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const DOT = 'inline-flex size-5 items-center justify-center rounded-full bg-white dark:bg-gray-900';
const ICON_COLOR = computed(() => ({
	resolve: isSubdued.value ? 'text-gray-400' : 'text-brand-500 dark:text-brand-400',
	reject: isSubdued.value ? 'text-gray-400' : 'text-orange-500 dark:text-orange-400',
}));
</script>

<template>
	<BoWorkspaceTile
		:id="panel['id']"
		:x="panel['x']"
		:y="panel['y']"
		:width="panel['width']"
		:height="panel['height']"
		:draggable="panel['draggable'] ?? true"
		:name="panel['panel_name']"
		:icon="type === 'trigger' ? panel['icon'] : currentOperation?.icon"
		:edit-mode="editMode"
		:grid-size="GRID_SIZE"
		:show-options="type !== 'trigger'"
		:data-panel-key="panel['key'] ?? panel['id']"
		:data-subdued="isSubdued ? '' : undefined"
		:data-reject="isReject ? '' : undefined"
		always-update-position
		@edit="emit('edit', panel)"
		@update="emit('update', { edits: $event, id: panel['id'] })"
		@move="emit('move', panel['id'])"
		@delete="emit('delete', panel['id'])"
		@duplicate="emit('duplicate', panel)"
		@pointerenter="pointerEnter"
		@pointerleave="pointerLeave"
	>
		<template #icon>
			<BoIcon
				:name="(type === 'trigger' ? panel['icon'] : currentOperation?.icon) ?? 'extension'"
				size="sm"
				:class="
					isSubdued
						? 'text-gray-400'
						: isReject
							? 'text-orange-500 dark:text-orange-400'
							: 'text-brand-500 dark:text-brand-400'
				"
			/>
		</template>

		<template #body>
			<button
				v-if="editMode || panel['resolve']"
				type="button"
				:class="[HANDLE, editMode ? 'cursor-pointer' : 'cursor-default']"
				:style="at(RESOLVE_OFFSET)"
				:tabindex="editMode ? undefined : -1"
				:aria-label="t('operation_handle_resolve')"
				:title="editMode ? t('operation_handle_resolve') : undefined"
				data-handle="resolve"
				@pointerdown.stop="pointerdown('resolve')"
			>
				<span :class="DOT"><BoIcon name="check_circle" size="sm" :class="ICON_COLOR.resolve" /></span>
			</button>
			<Transition
				enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
				leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
				enter-from-class="opacity-0"
				leave-to-class="opacity-0"
			>
				<button
					v-if="editMode && !panel['resolve'] && !moving && (panel['id'] === '$trigger' || isHovered)"
					type="button"
					:class="HANDLE"
					class="ms-[54px]"
					:style="at(RESOLVE_OFFSET)"
					:aria-label="t('operation_handle_resolve')"
					:title="t('operation_handle_resolve')"
					data-hint="resolve"
					@pointerdown.stop="pointerdown('resolve')"
				>
					<span :class="DOT"><BoIcon name="add_circle_outline" size="sm" :class="ICON_COLOR.resolve" /></span>
				</button>
			</Transition>
			<button
				v-if="panel['id'] !== '$trigger' && (editMode || panel['reject'])"
				type="button"
				:class="[HANDLE, editMode ? 'cursor-pointer' : 'cursor-default']"
				:style="at(REJECT_OFFSET)"
				:tabindex="editMode ? undefined : -1"
				:aria-label="t('operation_handle_reject')"
				:title="editMode ? t('operation_handle_reject') : undefined"
				data-handle="reject"
				@pointerdown.stop="pointerdown('reject')"
			>
				<span :class="DOT"><BoIcon name="cancel" size="sm" :class="ICON_COLOR.reject" /></span>
			</button>
			<Transition
				enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
				leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
				enter-from-class="opacity-0"
				leave-to-class="opacity-0"
			>
				<button
					v-if="editMode && !panel['reject'] && !moving && panel['id'] !== '$trigger' && isHovered"
					type="button"
					:class="HANDLE"
					class="ms-[54px]"
					:style="at(REJECT_OFFSET)"
					:aria-label="t('operation_handle_reject')"
					:title="t('operation_handle_reject')"
					data-hint="reject"
					@pointerdown.stop="pointerdown('reject')"
				>
					<span :class="DOT"><BoIcon name="add_circle_outline" size="sm" :class="ICON_COLOR.reject" /></span>
				</button>
			</Transition>

			<span
				v-if="panel['id'] !== '$trigger'"
				:class="[HANDLE, editMode && parent ? 'cursor-pointer' : 'cursor-default']"
				:style="at(ATTACHMENT_OFFSET)"
				aria-hidden="true"
				data-handle="input"
				@pointerdown.stop="pointerdown('parent')"
			>
				<span :class="DOT">
					<BoIcon name="adjust" size="sm" :class="isReject ? ICON_COLOR.reject : ICON_COLOR.resolve" />
				</span>
			</span>
		</template>

		<div class="flex min-h-0 flex-1 flex-col p-3">
			<p v-if="overviewError" class="m-0 flex items-center gap-2 text-theme-sm text-warning-600 dark:text-warning-400">
				<BoIcon name="warning" size="sm" />
				{{ t('unexpected_error') }}
			</p>
			<OptionsOverview
				v-else-if="typeof currentOperation?.overview === 'function'"
				:panel="panel"
				:current-operation="currentOperation"
				:flow="flow"
			/>
			<span v-if="isSubdued" class="sr-only">
				{{ subdued ? t('inactive') : t('flow_operation_not_linked') }}
			</span>
		</div>

		<template v-if="panel['id'] === '$trigger'" #footer>
			<div class="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
				<span
					class="size-2 shrink-0 rounded-full"
					:class="flowStatus === 'active' ? 'bg-brand-500' : 'bg-gray-400'"
					:title="flowStatus === 'active' ? t('active') : t('inactive')"
					aria-hidden="true"
				/>
				<label v-if="editMode" class="sr-only" :for="`flow-status-${flow.id}`">{{ t('status') }}</label>
				<BoSelect
					v-if="editMode"
					:id="`flow-status-${flow.id}`"
					v-model="flowStatus"
					class="min-w-0 flex-1"
					:items="[
						{ text: t('active'), value: 'active' },
						{ text: t('inactive'), value: 'inactive' },
					]"
				/>
				<span v-else>{{ flowStatus === 'active' ? t('active') : t('inactive') }}</span>
			</div>
		</template>
	</BoWorkspaceTile>
</template>
