<!-- Ported from directus/app/src/interfaces/select-icon/select-icon.vue -->
<script setup lang="ts">
import formatTitle from '@directus/format-title';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, nextTick, onUnmounted, type Ref, ref, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import BoIcon from './BoIcon.vue';
import icons from './icon-picker/icons.json';
import { socialIcons } from './icon-picker/social-icons.ts';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

// Backoffice: generic picker (trigger + panel) with modelValue; the select-icon interface maps `value`/`input`.
// The trigger is a button (IconPicker recipe) and the search field sits in the panel.
const props = withDefaults(
	defineProps<{
		modelValue?: string | null | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		placeholder?: string | undefined;
		id?: string | undefined;
		invalid?: boolean;
		/** Form linking on the trigger (FormField ids); the trigger name is the label followed by the icon name. */
		ariaLabelledby?: string | undefined;
		ariaDescribedby?: string | undefined;
	}>(),
	{
		modelValue: null,
		placeholder: undefined,
		id: undefined,
		ariaLabelledby: undefined,
		ariaDescribedby: undefined,
	},
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const { t } = useI18n();

const triggerId = props.id ?? useId();
const valueId = `${triggerId}-value`;

const searchQuery = ref('');
const menuActive = ref(false);
const contentRef = useTemplateRef<HTMLElement>('contentRef');

// for virtual scroller
const MIN_ITEM_SIZE = 32;

// Backoffice: 40px icon buttons with a 4px gap and the 12px side padding of the recipe.
const { iconsPerRow } = useIconsPerRow(contentRef, menuActive, {
	iconSize: 40,
	gap: 4,
	contentPadding: 24,
	rowPadding: 0,
});

const mergedIcons = [
	...icons,
	{
		name: 'Social',
		icons: socialIcons,
	},
];

const filteredIcons = computed(() => {
	if (searchQuery.value.length === 0) return mergedIcons;

	return mergedIcons.map((group) => {
		const icons = group.icons.filter((icon) => icon.includes(searchQuery.value.toLowerCase()));

		return {
			name: group.name,
			icons,
		};
	});
});

// Create flattened rows for virtualization
const virtualRows = computed(() => {
	const rows: Array<{
		type: 'header' | 'icons';
		groupName?: string;
		icons?: string[];
		rowIndex: number;
		groupIndex: number;
	}> = [];

	filteredIcons.value.forEach((group, groupIndex) => {
		if (group.icons.length > 0) {
			// Add group header
			rows.push({
				type: 'header',
				groupName: group.name,
				rowIndex: rows.length,
				groupIndex,
			});

			// Split icons into rows
			for (let i = 0; i < group.icons.length; i += iconsPerRow.value) {
				const rowIcons = group.icons.slice(i, i + iconsPerRow.value);

				rows.push({
					type: 'icons',
					icons: rowIcons,
					rowIndex: rows.length,
					groupIndex,
				});
			}
		}
	});

	return rows;
});

function setIcon(icon: string | null) {
	searchQuery.value = '';
	emit('update:modelValue', icon);
}

interface IconsPerRowConfig {
	iconSize?: number;
	gap?: number;
	contentPadding?: number;
	rowPadding?: number;
	defaultIconsPerRow?: number;
}

function useIconsPerRow(
	contentRef: Readonly<Ref<HTMLElement | null | undefined>>,
	menuActive: Ref<boolean>,
	config: IconsPerRowConfig = {},
) {
	const { iconSize = 24, gap = 8, contentPadding = 16, rowPadding = 8, defaultIconsPerRow = 1 } = config;

	const iconsPerRow = ref(defaultIconsPerRow);
	let resizeObserver: ResizeObserver | null = null;

	function calculateIconsPerRow() {
		if (!contentRef.value) return;

		const contentWidth = contentRef.value.clientWidth;

		const availableWidth = contentWidth - contentPadding - rowPadding;
		const iconsPerRowCalculated = Math.floor(availableWidth / (iconSize + gap));

		iconsPerRow.value = Math.max(defaultIconsPerRow, iconsPerRowCalculated);
	}

	function setupResizeObserver() {
		if (!contentRef.value) return;

		if (resizeObserver) {
			resizeObserver.disconnect();
		}

		resizeObserver = new ResizeObserver(() => {
			calculateIconsPerRow();
		});

		resizeObserver.observe(contentRef.value);
	}

	function cleanupResizeObserver() {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
	}

	// Calculate icons per row when menu opens
	watch(menuActive, async (isActive) => {
		if (isActive) {
			await nextTick();
			setupResizeObserver();
			calculateIconsPerRow();
		} else {
			cleanupResizeObserver();
		}
	});

	// Cleanup on unmount
	onUnmounted(() => {
		cleanupResizeObserver();
	});

	return {
		iconsPerRow,
		iconSize,
		gap,
		contentPadding,
		rowPadding,
		defaultIconsPerRow,
	};
}

// Backoffice: one Tab stop for the grid (roving tabindex), arrows move by icon and by row (IconPicker recipe).
// shortcut: the Tab stop is the first icon after a search or open; if it scrolled out of the virtual window the grid
// is reached with the arrows from a visible icon only after clicking or scrolling back, upgrade with scrollToItem.
const iconRows = computed(() => virtualRows.value.filter((row) => row.type === 'icons').map((row) => row.icons!));
const focused = ref({ row: 0, col: 0 });

watch([searchQuery, menuActive, iconsPerRow], () => (focused.value = { row: 0, col: 0 }));

async function onGridKeydown(event: KeyboardEvent) {
	const rows = iconRows.value;
	if (rows.length === 0) return;

	const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
	let { row, col } = focused.value;

	switch (event.key) {
		case rtl ? 'ArrowLeft' : 'ArrowRight':
			col++;
			if (col >= rows[row]!.length && row < rows.length - 1) [row, col] = [row + 1, 0];
			break;
		case rtl ? 'ArrowRight' : 'ArrowLeft':
			col--;
			if (col < 0 && row > 0) [row, col] = [row - 1, rows[row - 1]!.length - 1];
			break;
		case 'ArrowDown':
			row++;
			break;
		case 'ArrowUp':
			row--;
			break;
		case 'Home':
			col = 0;
			break;
		case 'End':
			col = rows[row]!.length - 1;
			break;
		default:
			return;
	}

	event.preventDefault();
	row = Math.min(Math.max(row, 0), rows.length - 1);
	col = Math.min(Math.max(col, 0), rows[row]!.length - 1);
	focused.value = { row, col };

	await nextTick();
	contentRef.value?.querySelector<HTMLElement>(`[data-icon-button="${rows[row]![col]}"]`)?.focus();
}

function onIconFocus(icon: string) {
	const row = iconRows.value.findIndex((icons) => icons.includes(icon));
	if (row !== -1) focused.value = { row, col: iconRows.value[row]!.indexOf(icon) };
}

function isFocusStop(icon: string) {
	return iconRows.value[focused.value.row]?.[focused.value.col] === icon;
}

function selectIcon(icon: string) {
	setIcon(icon);
	menuActive.value = false;
}

// component-specs FOCUS, FIELD, ICON_BTN and IconPicker recipe.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FIELD =
	'w-full rounded-lg border bg-transparent text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03]';
const FIELD_VALID = `border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 ${FOCUS} dark:border-gray-500 dark:focus:border-brand-400`;
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
const ICON = `flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 ${FOCUS} aria-pressed:bg-brand-50 aria-pressed:text-brand-600 aria-pressed:ring-1 aria-pressed:ring-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:aria-pressed:bg-brand-500/15 dark:aria-pressed:text-brand-400 dark:aria-pressed:ring-brand-400`;
</script>

<template>
	<PopoverRoot v-model:open="menuActive">
		<div class="bo-icon-picker relative">
			<!-- as-child: Reka's PopoverTrigger would replace the id the field label points at. -->
			<PopoverTrigger as-child>
				<button
					:id="triggerId"
					type="button"
					class="flex h-11 items-center gap-3 px-4 py-2.5 pe-12 text-start"
					:class="[FIELD, invalid ? FIELD_INVALID : FIELD_VALID]"
					:disabled="disabled || nonEditable"
					:aria-labelledby="ariaLabelledby ? `${ariaLabelledby} ${valueId}` : undefined"
					:aria-describedby="ariaDescribedby"
					:aria-invalid="invalid ? 'true' : undefined"
				>
					<template v-if="modelValue">
						<BoIcon :name="modelValue" size="sm" class="text-gray-800 dark:text-white/90" />
						<span :id="valueId" class="truncate">{{ formatTitle(modelValue) }}</span>
					</template>
					<span v-else :id="valueId" class="truncate text-gray-500 dark:text-gray-400">
						{{ placeholder || t('interfaces.select-icon.search_for_icon') }}
					</span>
				</button>
			</PopoverTrigger>
			<div class="item-actions absolute end-1.5 top-1/2 -translate-y-1/2">
				<button
					v-if="modelValue !== null && !nonEditable"
					type="button"
					:class="ICON_BTN"
					:disabled
					:aria-label="t('clear_value')"
					@click="setIcon(null)"
				>
					<BoIcon name="close" size="sm" />
				</button>
				<BoIcon
					v-else
					name="expand_more"
					size="sm"
					class="pointer-events-none me-1.5 text-gray-500 transition-transform motion-reduce:transition-none dark:text-gray-400"
					:class="{ '-scale-y-100': menuActive }"
				/>
			</div>
		</div>

		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				:collision-padding="8"
				class="z-99999 max-h-(--reka-popover-content-available-height) w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
			>
				<div class="m-3">
					<label :for="`${triggerId}-search`" class="sr-only">{{ t('search') }}</label>
					<input
						:id="`${triggerId}-search`"
						v-model="searchQuery"
						type="search"
						autocomplete="off"
						:placeholder="t('interfaces.select-icon.search_for_icon')"
						class="h-9 px-4"
						:class="[FIELD, FIELD_VALID]"
					/>
				</div>

				<div ref="contentRef" class="select-icon-popover" @keydown="onGridKeydown">
					<DynamicScroller
						v-if="virtualRows.length > 0"
						:min-item-size="MIN_ITEM_SIZE"
						:items="virtualRows"
						:buffer="400"
						:prerender="10"
						key-field="rowIndex"
						class="h-80 overflow-y-auto pb-3 custom-scrollbar"
					>
						<template #default="{ item, active }">
							<!-- Backoffice: pooled views out of use keep their last row offscreen; they render nothing so that
								 stale icons are not focusable or read out. -->
							<DynamicScrollerItem :item="item" :active="active">
								<div
									v-if="active && item.type === 'header'"
									class="px-3 pt-3 pb-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400"
								>
									{{ item.groupName }}
								</div>

								<div
									v-else-if="active && item.type === 'icons'"
									class="grid gap-1 px-3 pb-1"
									:style="{ gridTemplateColumns: `repeat(${iconsPerRow}, 2.5rem)` }"
								>
									<button
										v-for="icon in item.icons"
										:key="icon"
										type="button"
										:class="ICON"
										:data-icon-button="icon"
										:tabindex="isFocusStop(icon) ? 0 : -1"
										:aria-label="icon"
										:aria-pressed="icon === modelValue"
										@focus="onIconFocus(icon)"
										@click="selectIcon(icon)"
									>
										<BoIcon :name="icon" size="md" />
									</button>
								</div>
							</DynamicScrollerItem>
						</template>
					</DynamicScroller>
					<p
						v-else
						class="flex items-center justify-center gap-2 px-3 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400"
					>
						<BoIcon name="search_off" size="sm" />
						{{ t('no_results') }}
					</p>
				</div>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
