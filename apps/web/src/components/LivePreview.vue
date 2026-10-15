<!-- Ported from directus/app/src/views/private/components/live-preview.vue -->
<script setup lang="ts">
// Backoffice: no visual editing (D-67): no editable elements toggle, editing layer, "open in visual editor", dynamic
// URL, sidebar split, overlay/notification slots or header slots (all only used by the Visual Editor module). The
// display options come as menu items (BoMenu) instead of a slot of list items. Toolbar and frame follow
// layout-patterns §10; a top progress bar shows the refresh like the button spinner of Directus.
import { useElementSize, useResizeObserver } from '@vueuse/core';
import { computed, type CSSProperties, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from './BoButton.vue';
import BoIcon from './BoIcon.vue';
import BoInfo from './BoInfo.vue';
import BoMenu, { type BoMenuItem } from './BoMenu.vue';
import BoProgressLinear from './BoProgressLinear.vue';
import BoTextOverflow from './BoTextOverflow.vue';
import BoTooltip from './BoTooltip.vue';

declare global {
	interface Window {
		refreshLivePreview: (url: string | null) => void;
	}
}

const {
	url,
	invalidUrl = false,
	singleUrlSubdued = true,
	inPopup = false,
	isFullWidth = false,
	displayOptions = [],
} = defineProps<{
	url: string | string[];
	invalidUrl?: boolean;
	singleUrlSubdued?: boolean;
	inPopup?: boolean;
	isFullWidth?: boolean;
	/** Items of the display options menu; "open in new window" is appended. No items: no menu (Directus slot). */
	displayOptions?: BoMenuItem[];
}>();

const emit = defineEmits<{
	'new-window': [];
	selectUrl: [newUrl: string, oldUrl: string];
	'exit-full-width': [];
}>();

const { t } = useI18n();

const { urls, frameSrc, urlDisplay, multipleUrls, selectUrl } = useUrls();

const width = ref<number>();
const height = ref<number>();
const zoom = ref<number>(1);

const zoomOptions = [
	{ text: '25%', value: 0.25 },
	{ text: '50%', value: 0.5 },
	{ text: '75%', value: 0.75 },
	{ text: '100%', value: 1 },
	{ text: '150%', value: 1.5 },
	{ text: '200%', value: 2 },
];

const displayWidth = ref<number>();
const displayHeight = ref<number>();
const isRefreshing = ref(false);

const livePreviewEl = ref<HTMLElement>();
const resizeHandle = ref<HTMLDivElement>();
const frameEl = ref<HTMLIFrameElement>();

const livePreviewSize = useElementSize(livePreviewEl);

// Backoffice: @vueuse useResizeObserver follows the handle when it appears after an invalid URL (Directus re-creates
// the observer on that change) and disconnects on unmount.
useResizeObserver(resizeHandle, () => {
	if (!resizeHandle.value) return;

	displayWidth.value = resizeHandle.value.offsetWidth;
	displayHeight.value = resizeHandle.value.offsetHeight;

	if (width.value === undefined && height.value === undefined) return;

	width.value = resizeHandle.value.offsetWidth;
	height.value = resizeHandle.value.offsetHeight;
});

const iframeViewStyle = computed(() => {
	const style: CSSProperties = {};

	if (zoom.value <= 1) {
		style.placeItems = 'center';
	}

	if (zoom.value > 1 && width.value && height.value) {
		const paddingWidth = (livePreviewSize.width.value - width.value * zoom.value) / 2;
		const paddingInlineStart = Math.max((livePreviewSize.width.value - width.value * zoom.value) / 2, 48);
		style.paddingInlineStart = `${paddingInlineStart}px`;

		if (paddingWidth < 48) {
			const iframeViewWidth = 48 + width.value * zoom.value + 48;
			style.inlineSize = `${iframeViewWidth}px`;
		}

		const paddingHeight = (livePreviewSize.height.value - 44 - height.value * zoom.value) / 2;
		const paddingBlockStart = Math.max(paddingHeight, 48);
		style.paddingBlockStart = `${paddingBlockStart}px`;

		if (paddingHeight < 48) {
			const iframeViewHeight = 48 + height.value * zoom.value + 48;
			style.blockSize = `${iframeViewHeight}px`;
		}
	}

	return style;
});

const fullscreen = computed(() => {
	return width.value === undefined && height.value === undefined;
});

const showDimensions = computed(() => !!frameSrc.value && !invalidUrl);

const menuItems = computed<BoMenuItem[]>(() => [
	...displayOptions,
	{ text: t('live_preview.new_window'), icon: 'open_in_new', onSelect: () => emit('new-window') },
]);

const zoomItems = computed<BoMenuItem[]>(() =>
	zoomOptions.map((option) => ({ text: option.text, onSelect: () => (zoom.value = option.value) })),
);

const urlItems = computed<BoMenuItem[]>(() =>
	urls.value.map((urlItem) => ({ text: urlItem, onSelect: () => selectUrl(urlItem) })),
);

function toggleFullscreen() {
	if (fullscreen.value) {
		width.value = 400;
		height.value = 600;
	} else {
		width.value = undefined;
		height.value = undefined;
		zoom.value = 1;
	}
}

function refresh(url: string | null) {
	if (!frameEl.value || isRefreshing.value) return;

	isRefreshing.value = true;

	// this is technically a self-assignment, but it works to refresh the iframe
	const newSrc = url || frameEl.value.src;
	frameEl.value.src = newSrc;
}

function onIframeLoad() {
	isRefreshing.value = false;
}

window.refreshLivePreview = refresh;

function useUrls() {
	const internalFrameSrc = ref<string>();
	const urls = computed(() => (Array.isArray(url) ? url : [url]));
	const multipleUrls = computed(() => urls.value.length > 1);

	const frameSrc = computed({
		get: () => internalFrameSrc.value ?? urls.value[0],
		set(value) {
			internalFrameSrc.value = value;
		},
	});

	const urlDisplay = computed(() => {
		if (invalidUrl) return t('select');
		return frameSrc.value;
	});

	return { urls, frameSrc, urlDisplay, multipleUrls, selectUrl };

	function selectUrl(newUrl: string) {
		emit('selectUrl', newUrl, String(frameSrc.value));

		if (frameSrc.value === newUrl) {
			refresh(null);
			return;
		}

		frameSrc.value = newUrl;
	}
}

// Directus @container (max-width: 27rem): the size controls win over the left group, a disabled size block hides.
const NARROW_HIDDEN = '@max-[27rem]:hidden';
const INPUT =
	'h-8 w-16 rounded-lg border border-gray-300 bg-transparent px-2 text-center text-theme-xs text-gray-800 focus:border-brand-500 focus:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400 dark:disabled:text-gray-600';
</script>

<template>
	<div
		ref="livePreviewEl"
		class="@container flex size-full flex-col border-s border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
	>
		<div class="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800">
			<div class="flex min-w-0 items-center gap-2" :class="{ [NARROW_HIDDEN]: showDimensions && !fullscreen }">
				<BoTooltip v-if="isFullWidth" :text="t('live_preview.exit_full_width')" side="bottom">
					<BoButton
						variant="ghost"
						icon="width_full"
						:aria-label="t('live_preview.exit_full_width')"
						@click="emit('exit-full-width')"
					/>
				</BoTooltip>

				<BoTooltip v-else-if="inPopup" :text="t('live_preview.close_window')" side="bottom">
					<BoButton
						variant="ghost"
						icon="exit_to_app"
						:aria-label="t('live_preview.close_window')"
						@click="emit('new-window')"
					/>
				</BoTooltip>

				<BoMenu v-else-if="displayOptions.length > 0" :items="menuItems">
					<template #trigger>
						<BoButton variant="ghost" icon="display_settings" :aria-label="t('live_preview.display_options')" />
					</template>
				</BoMenu>

				<BoTooltip :text="t('live_preview.refresh')" side="bottom">
					<BoButton
						variant="ghost"
						icon="refresh"
						:aria-label="t('live_preview.refresh')"
						:loading="isRefreshing"
						:disabled="!frameSrc || invalidUrl"
						@click="refresh(null)"
					/>
				</BoTooltip>

				<BoMenu v-if="multipleUrls" :items="urlItems">
					<template #trigger>
						<button
							type="button"
							data-url
							class="flex min-w-0 items-center rounded text-theme-xs text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:focus-visible:outline-brand-400"
						>
							<BoTextOverflow :text="urlDisplay" />
							<BoIcon name="arrow_drop_down" size="sm" />
						</button>
					</template>
				</BoMenu>
				<div
					v-else-if="urls.length"
					data-url
					class="min-w-0 text-theme-xs"
					:class="singleUrlSubdued ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'"
				>
					<BoTextOverflow :text="urlDisplay" />
				</div>
			</div>

			<div class="flex-1" />

			<div
				v-if="showDimensions"
				data-dimensions
				class="flex items-center gap-1 text-gray-500 dark:text-gray-400"
				:class="{ [NARROW_HIDDEN]: fullscreen }"
			>
				<input
					:value="displayWidth"
					:class="INPUT"
					:aria-label="t('width')"
					inputmode="numeric"
					:disabled="fullscreen"
					@input="width = Number(($event.target as HTMLInputElement).value)"
				/>
				<BoIcon name="close" size="sm" />
				<input
					:value="displayHeight"
					:class="INPUT"
					:aria-label="t('height')"
					inputmode="numeric"
					:disabled="fullscreen"
					@input="height = Number(($event.target as HTMLInputElement).value)"
				/>

				<BoMenu :items="zoomItems" align="end">
					<template #trigger>
						<button
							type="button"
							:disabled="fullscreen"
							:aria-label="`${t('zoom')} ${zoomOptions.find((option) => option.value === zoom)?.text || zoom}`"
							class="flex h-8 items-center rounded-lg px-1 text-theme-xs whitespace-nowrap text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-gray-300 dark:focus-visible:outline-brand-400 dark:disabled:text-gray-600"
						>
							<span>{{ zoomOptions.find((option) => option.value === zoom)?.text || zoom }}</span>
							<BoIcon name="arrow_drop_down" size="sm" />
						</button>
					</template>
				</BoMenu>
			</div>

			<BoTooltip :text="t('live_preview.change_size')" side="bottom">
				<BoButton
					:variant="fullscreen ? 'ghost' : 'secondary'"
					icon="devices"
					:aria-label="t('live_preview.change_size')"
					:aria-pressed="!fullscreen"
					:disabled="!frameSrc || invalidUrl"
					@click="toggleFullscreen"
				/>
			</BoTooltip>
		</div>

		<div v-if="!frameSrc" class="flex grow items-center justify-center p-6">
			<BoInfo :title="t('no_url')" icon="edit_square">{{ t('no_url_copy') }}</BoInfo>
		</div>

		<div v-else-if="invalidUrl" class="flex grow items-center justify-center p-6">
			<BoInfo :title="t('invalid_url')" type="danger" icon="edit_square">{{ t('invalid_url_copy') }}</BoInfo>
		</div>

		<div v-else class="relative min-h-0 grow">
			<div v-if="isRefreshing" class="absolute inset-x-0 top-0 z-10">
				<BoProgressLinear indeterminate :aria-label="t('live_preview.refresh')" />
			</div>
			<div class="grid size-full overflow-auto" :class="fullscreen ? 'p-0' : 'p-11'" :style="iframeViewStyle">
				<div
					ref="resizeHandle"
					class="overflow-hidden"
					:class="{ 'shadow-theme-md': !fullscreen }"
					:style="{
						inlineSize: width ? `${width}px` : '100%',
						blockSize: height ? `${height}px` : '100%',
						resize: fullscreen ? 'none' : 'both',
						transform: `scale(${zoom})`,
						transformOrigin: zoom >= 1 ? 'top left' : 'center center',
					}"
				>
					<iframe
						id="frame"
						ref="frameEl"
						class="size-full border-0 bg-white"
						:src="frameSrc"
						:title="t('live_preview.iframe_title')"
						@load="onIframeLoad"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
