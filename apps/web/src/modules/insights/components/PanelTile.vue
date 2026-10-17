<!-- Ported from directus/app/src/modules/insights/routes/dashboard.vue (tile slot); Ported from directus/app/src/components/v-workspace-tile.vue (header) -->
<script setup lang="ts">
// Backoffice (spec 018 FR-020, FR-021, FR-106, recipe Q-34): one dashboard tile. The header (icon in the panel color,
// name, note) is drawn here instead of BoWorkspaceTile's, whose header keeps the flows look; the note is an icon button
// with a tooltip on hover and focus (Directus: a span with a mouse-only tooltip, "Cần xác nhận"). States as Directus:
// spinner on the first load, 50 % opacity while reloading, the error with its code, `no_data`; VErrorBoundary is
// onErrorCaptured. The tile is a region named after the panel (or its type).
import { isEmpty } from 'lodash-es';
import { computed, onErrorCaptured, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../components/BoIcon.vue';
import BoProgressCircular from '../../../components/BoProgressCircular.vue';
import BoTooltip from '../../../components/BoTooltip.vue';
import BoWorkspaceTile, { type AppTile, type TilePosition } from '../../../components/workspace/BoWorkspaceTile.vue';
import { PANEL_LABEL } from '../../../panels/shared/panel-label.ts';
import type { PanelConfig } from '../../../panels/types.ts';
import { extractErrorCode } from '../../../utils/extract-error-code.ts';
import { translate } from '../../../utils/translate-object-values.ts';

const props = defineProps<{
	tile: AppTile;
	panelType: PanelConfig | undefined;
	editMode: boolean;
	gridSize: number;
	dashboard: string;
	now: Date;
	loading: boolean;
	error: unknown;
	data: unknown;
	hasData: boolean;
}>();

defineEmits<{
	update: [edits: TilePosition];
	edit: [];
	move: [];
	duplicate: [];
	delete: [];
}>();

const { t } = useI18n();

const renderError = ref<unknown>(null);

onErrorCaptured((error) => {
	renderError.value = error;
	return false;
});

const label = computed(
	() => props.tile.name || (props.panelType ? translate(props.panelType.name) : props.tile.data?.['type']),
);

provide(PANEL_LABEL, label);

const error = computed(() => props.error ?? renderError.value);

function errorText(value: unknown): string {
	const message =
		(value as { message?: string } | null)?.message ??
		(value as { errors?: { message?: string }[] } | null)?.errors?.[0]?.message ??
		'';
	return `[${extractErrorCode(value)}] ${message}`.trim();
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<BoWorkspaceTile
		:id="tile.id"
		:x="tile.x"
		:y="tile.y"
		:width="tile.width"
		:height="tile.height"
		:name="tile.name"
		:show-header="false"
		:edit-mode="editMode"
		:grid-size="gridSize"
		:min-width="tile['minWidth']"
		:min-height="tile['minHeight']"
		:border-radius="tile['borderRadius']"
		resizable
		role="region"
		:aria-label="label"
		:data-panel-id="tile.id"
		:data-panel-type="tile.data?.['type']"
		@update="$emit('update', $event)"
		@edit="$emit('edit')"
		@move="$emit('move')"
		@duplicate="$emit('duplicate')"
		@delete="$emit('delete')"
	>
		<div
			v-if="tile.showHeader"
			class="flex h-10 shrink-0 items-center gap-2 px-4"
			:class="{ 'pe-20': editMode }"
			data-panel-header
		>
			<BoIcon
				:name="tile.icon ?? 'space_dashboard'"
				size="sm"
				class="shrink-0"
				:class="{ 'text-brand-500 dark:text-brand-400': !tile['color'] }"
				:style="tile['color'] ? { color: tile['color'] } : undefined"
			/>
			<span class="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90" data-panel-name>
				{{ tile.name }}
			</span>
			<BoTooltip v-if="tile['note']" :text="tile['note']">
				<button
					type="button"
					class="pointer-events-auto ms-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
					:class="FOCUS"
					:aria-label="tile['note']"
				>
					<BoIcon name="info" size="sm" />
				</button>
			</BoTooltip>
		</div>

		<div
			v-if="loading && !hasData"
			class="flex flex-1 items-center justify-center"
			:aria-label="t('loading')"
			data-panel-state="loading"
		>
			<BoProgressCircular indeterminate />
		</div>
		<div
			v-else
			class="relative flex min-h-0 flex-1 flex-col transition-opacity motion-reduce:transition-none"
			:class="[loading ? 'opacity-50' : 'opacity-100', tile.showHeader ? 'px-4 pb-4' : 'p-4']"
		>
			<div
				v-if="error"
				class="flex flex-1 flex-col items-center justify-center gap-1 text-center text-theme-sm text-gray-700 dark:text-gray-300"
				data-panel-state="error"
			>
				<BoIcon name="warning" class="text-error-500" />
				{{ $t('unexpected_error') }}
				<code class="max-w-full truncate text-theme-xs text-gray-500 dark:text-gray-400">{{ errorText(error) }}</code>
			</div>
			<div
				v-else-if="hasData && isEmpty(data)"
				class="flex flex-1 items-center justify-center text-theme-sm text-gray-500 dark:text-gray-400"
				data-panel-state="no-data"
			>
				{{ $t('no_data') }}
			</div>
			<component
				:is="panelType.component"
				v-else-if="panelType"
				v-bind="tile.data?.['options']"
				:id="tile.id"
				:dashboard="dashboard"
				:show-header="tile.showHeader"
				:height="tile.height"
				:width="tile.width"
				:now="now"
				:data="data"
				:grid-size="gridSize"
			/>
		</div>
	</BoWorkspaceTile>
</template>
