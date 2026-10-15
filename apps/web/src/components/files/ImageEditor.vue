<!-- Ported from directus/app/src/views/private/components/image-editor.vue -->
<script setup lang="ts">
// Backoffice: user story 5 of feature 015 (FR-040 to FR-046, D-59 lifted), recipe "Image editor" (Q-16). A flush
// BoDrawer; the toolbar is a row of named buttons with BoTooltip (three tools as a pressed group), the aspect ratio
// menu is a BoMenu with a check on the current ratio. Cropper.js and its CSS load when the editor opens (lazy chunk,
// research R10). Writes go through the SDK (`updateFile` / `uploadFiles` for FormData, PATCH JSON for the focal point
// alone). An image that fails to load shows an error notice and keeps save disabled (CHK017). Dragging the crop box
// and the focal point is mouse only, as in Directus (FR-046, owner 2026-10-15).
import { updateFile, uploadFiles } from '@directus/sdk';
import type { File } from '@directus/types';
import type Cropper from 'cropperjs';
import { isEqual, throttle } from 'lodash-es';
import { nanoid } from 'nanoid/non-secure';
import { computed, nextTick, reactive, ref, type Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import BoButton from '../BoButton.vue';
import BoIcon from '../BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../BoMenu.vue';
import BoNotice from '../BoNotice.vue';
import BoProgressCircular from '../BoProgressCircular.vue';
import BoTooltip from '../BoTooltip.vue';
import BoDrawer from '../drawers/BoDrawer.vue';

const imageFields = [
	'type',
	'filesize',
	'filename_download',
	'folder',
	'width',
	'height',
	'focal_point_x',
	'focal_point_y',
] as const;

type Image = Pick<File, (typeof imageFields)[number]>;

const props = defineProps<{
	id: string;
	modelValue?: boolean;
	createAllowed?: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
	(e: 'refresh'): void;
	(e: 'new-file', id: string): void;
}>();

const { t, n } = useI18n();

const settingsStore = useSettingsStore();

const localActive = ref(false);

const internalActive = computed({
	get() {
		return props.modelValue === undefined ? localActive.value : props.modelValue;
	},
	set(newActive: boolean) {
		localActive.value = newActive;
		emit('update:modelValue', newActive);
	},
});

const { loading, error, imageError, imageData, imageElement, hasEdits, save, saveAsNew, saving, fetchImage, onImageLoad } =
	useImage();

const {
	cropperInstance,
	initCropper,
	flip,
	rotate,
	reset,
	aspectRatio,
	aspectRatioIcon,
	newDimensions,
	dragMode,
	cropping,
} = useCropper();

watch(
	internalActive,
	(isActive) => {
		if (isActive === true) {
			fetchImage();
		} else {
			if (cropperInstance.value) {
				cropperInstance.value.destroy();
				cropperInstance.value = null;
			}

			loading.value = false;
			error.value = null;
			imageError.value = false;
			imageData.value = null;
		}
	},
	{ immediate: true },
);

const randomId = ref<string>(nanoid());

const imageURL = computed(() => {
	return getAssetUrl(`${props.id}?${randomId.value}`);
});

const dimensionsString = computed(() => {
	let output = '';
	const isSVG = imageData.value?.type === 'image/svg+xml';

	if (imageData.value) {
		if (isSVG) {
			output += 'SVG';
		} else {
			output += `${n(imageData.value.width ?? 0)}x${n(imageData.value.height ?? 0)}`;
		}

		if (imageData.value.width !== newDimensions.width || imageData.value.height !== newDimensions.height) {
			if (isSVG) {
				if (newDimensions.width || newDimensions.height) {
					output += ` -> PNG ${n(newDimensions.width ?? 0)}x${n(newDimensions.height ?? 0)}`;
				} else {
					output += ' -> PNG';
				}
			} else {
				output += ` -> ${isSVG ? 'PNG ' : ''}${n(newDimensions.width ?? 0)}x${n(newDimensions.height ?? 0)}`;
			}
		}
	}

	return output;
});

const customAspectRatios = computed(
	() => (settingsStore.settings?.custom_aspect_ratios as { text: string; value: number }[] | null | undefined) ?? null,
);

function useImage() {
	const loading = ref(false);
	const error = ref<unknown>(null);
	const imageError = ref(false);
	const imageData = ref<Image | null>(null);
	const saving = ref(false);

	const imageElement = ref<HTMLImageElement | null>(null);

	const hasEdits = computed(() => {
		if (imageError.value) return false;

		return (
			!isEqual(
				{ x: 0, y: 0, width: 0, height: 0, rotate: 0, scaleX: 1, scaleY: 1 },
				cropperInstance.value?.getData(),
			) || cropping.value
		);
	});

	return {
		loading,
		error,
		imageError,
		imageData,
		fetchImage,
		imageElement,
		hasEdits,
		save,
		saveAsNew,
		saving,
		onImageLoad,
	};

	async function fetchImage() {
		try {
			loading.value = true;

			imageData.value = await sdk.request(
				requestEndpoint<Image>(`/files/${props.id}`, { method: 'GET', params: { fields: [...imageFields] } }),
			);
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	}

	function croppedBlob(): Promise<Blob> {
		// Wrap the callback so that we can actually listen to it
		return new Promise<Blob>((resolve, reject) => {
			const canvas = cropperInstance.value?.getCroppedCanvas({ imageSmoothingQuality: 'high' });
			if (!canvas) return reject(new Error(`Couldn't process and save edited image`));

			canvas.toBlob(
				(blob) => (blob === null ? reject(new Error(`Couldn't process and save edited image`)) : resolve(blob)),
				imageData.value?.type ?? undefined,
			);
		});
	}

	async function saveImage(focalPoint?: { x: number | null; y: number | null }) {
		const blob = await croppedBlob();
		const formData = new FormData();

		if (focalPoint) {
			formData.append('focal_point_x', focalPoint.x?.toString() ?? '');
			formData.append('focal_point_y', focalPoint.y?.toString() ?? '');
		}

		formData.append('file', blob, imageData.value?.filename_download ?? undefined);

		await sdk.request(updateFile(props.id, formData));
	}

	async function saveAsNew() {
		if (!hasEdits.value || saving.value) return;

		saving.value = true;

		try {
			const blob = await croppedBlob();
			const formData = new FormData();

			if (imageData.value?.folder) {
				formData.append('folder', imageData.value.folder as string);
			}

			formData.append('file', blob, imageData.value?.filename_download ?? undefined);

			const created = (await sdk.request(uploadFiles(formData))) as { id: string };
			emit('new-file', created.id);
			localDragMode.value = 'move';
			internalActive.value = false;
		} catch (err) {
			showUnexpectedError(err);
		} finally {
			saving.value = false;
		}
	}

	async function save() {
		if (!hasEdits.value || saving.value) return;

		saving.value = true;

		// Only save focal point if we're also actively selecting it
		const gotChangeForFocalPoint = localDragMode.value === 'focal_point' && cropping.value;

		let focalPointX = null;
		let focalPointY = null;

		// Important: Check focal point first because we must(!) reset the cropping area
		// before saving so that we're not wrongfully cropping
		if (gotChangeForFocalPoint) {
			const data = cropperInstance.value?.getData();
			focalPointX = Math.round((data?.x ?? 0) + (data?.width ?? 0) / 2);
			focalPointY = Math.round((data?.y ?? 0) + (data?.height ?? 0) / 2);
			cropperInstance.value?.clear();
		}

		// Important: This check has to go after(!) we reset the cropping area because
		// `getData` returns info about our focal point, which leads to a false positive
		const gotChangeForImg = !isEqual(
			{ x: 0, y: 0, width: 0, height: 0, rotate: 0, scaleX: 1, scaleY: 1 },
			cropperInstance.value?.getData(),
		);

		try {
			// Collapse focal point patch request and image data into one request if we can
			if (gotChangeForImg && gotChangeForFocalPoint) {
				await saveImage({ x: focalPointX, y: focalPointY });
			} else if (gotChangeForImg) {
				await saveImage();
			} else if (gotChangeForFocalPoint) {
				await sdk.request(
					requestEndpoint(`/files/${props.id}`, {
						method: 'PATCH',
						body: { focal_point_x: focalPointX, focal_point_y: focalPointY } satisfies Partial<File>,
					}),
				);
			}

			emit('refresh');
			localDragMode.value = 'move';
			randomId.value = nanoid();
			internalActive.value = false;
		} catch (err) {
			showUnexpectedError(err);
		} finally {
			saving.value = false;
		}
	}

	async function onImageLoad() {
		await nextTick();
		await initCropper();
	}
}

const localDragMode = ref<'move' | 'crop' | 'focal_point'>('move');

function useCropper() {
	// A deep ref as Directus: `hasEdits` reads getData() through the proxy, so rotate/flip/crop update it.
	const cropperInstance = ref(null) as Ref<Cropper | null>;

	const localAspectRatio = ref(NaN);

	const newDimensions = reactive({
		width: null as null | number,
		height: null as null | number,
	});

	watch(imageData, () => {
		if (!imageData.value || !imageData.value.width || !imageData.value.height) return;
		localAspectRatio.value = imageData.value.width / imageData.value.height;
		newDimensions.width = imageData.value.width;
		newDimensions.height = imageData.value.height;
	});

	const aspectRatio = computed<number>({
		get() {
			return localAspectRatio.value;
		},
		set(newAspectRatio) {
			localAspectRatio.value = newAspectRatio;
			cropperInstance.value?.setAspectRatio(newAspectRatio);
			cropperInstance.value?.crop();
		},
	});

	const aspectRatioIcon = computed(() => {
		if (!imageData.value || !imageData.value.width || !imageData.value.height) return 'crop_original';

		if (customAspectRatios.value) {
			const customAspectRatio = customAspectRatios.value.find((customAR) => customAR.value == aspectRatio.value);
			if (customAspectRatio) return 'crop_square';
		}

		switch (aspectRatio.value) {
			case 16 / 9:
				return 'crop_16_9';
			case 3 / 2:
				return 'crop_3_2';
			case 5 / 4:
				return 'crop_5_4';
			case 7 / 5:
				return 'crop_7_5';
			case 1 / 1:
				return 'crop_square';
			case imageData.value.width / imageData.value.height:
				return 'crop_original';
			default:
				return 'crop_free';
		}
	});

	const dragMode = computed({
		get() {
			return localDragMode.value;
		},
		set(newMode) {
			cropperInstance.value?.setDragMode(newMode === 'move' ? 'move' : 'crop');
			localDragMode.value = newMode;

			if (newMode === 'move') {
				cropperInstance.value?.clear();
				localCropping.value = false;
			} else if (newMode === 'crop') {
				cropperInstance.value?.crop();
			} else if (newMode === 'focal_point') {
				const canvasData = cropperInstance.value?.getCanvasData();
				// Size the box as percentage so that it stays visible for both small and large images
				const boxSize = Math.max(16, (canvasData?.naturalWidth ?? 0) * 0.1);
				let centeredX = 0;
				let centeredY = 0;

				if (
					imageData.value &&
					imageData.value.focal_point_x !== null &&
					imageData.value.focal_point_y !== null &&
					imageData.value.focal_point_x !== undefined &&
					imageData.value.focal_point_y !== undefined
				) {
					centeredX = imageData.value.focal_point_x - boxSize / 2;
					centeredY = imageData.value.focal_point_y - boxSize / 2;
				} else {
					centeredX = (canvasData?.naturalWidth ?? 0) / 2 - boxSize / 2;
					centeredY = (canvasData?.naturalHeight ?? 0) / 2 - boxSize / 2;
				}

				aspectRatio.value = 1;
				cropperInstance.value?.setData({ x: centeredX, y: centeredY, width: boxSize, height: boxSize });
			}
		},
	});

	const localCropping = ref(false);

	const cropping = computed({
		get() {
			return localCropping.value;
		},
		set(newCropping: boolean) {
			if (newCropping === false) {
				cropperInstance.value?.clear();
			}

			localCropping.value = newCropping;
		},
	});

	return {
		cropperInstance,
		initCropper,
		flip,
		rotate,
		reset,
		aspectRatio,
		aspectRatioIcon,
		newDimensions,
		dragMode,
		cropping,
	};

	async function initCropper() {
		if (imageElement.value === null) return;

		// Backoffice: Cropper.js and its CSS are a lazy chunk (research R10).
		const [{ default: CropperClass }] = await Promise.all([
			import('cropperjs'),
			import('cropperjs/dist/cropper.css'),
		]);

		if (cropperInstance.value) {
			cropperInstance.value.destroy();
		}

		localCropping.value = false;
		localDragMode.value = 'move';

		cropperInstance.value = new CropperClass(imageElement.value, {
			autoCrop: false,
			autoCropArea: 0.5,
			toggleDragModeOnDblclick: false,
			dragMode: 'move',
			viewMode: 1,
			crop: throttle((event: Cropper.CropEvent) => {
				if (!imageData.value) return;

				if (cropping.value === false && (event.detail.width || event.detail.height)) {
					cropping.value = true;
				}

				const newWidth = event.detail.width || imageData.value.width || 0;
				const newHeight = event.detail.height || imageData.value.height || 0;

				if (event.detail.rotate === 0 || event.detail.rotate === -180) {
					newDimensions.width = Math.round(newWidth);
					newDimensions.height = Math.round(newHeight);
				} else {
					newDimensions.height = Math.round(newWidth);
					newDimensions.width = Math.round(newHeight);
				}
			}, 50),
		});
	}

	function flip(type: 'horizontal' | 'vertical') {
		if (type === 'vertical') {
			if (cropperInstance.value?.getData().scaleX === -1) {
				cropperInstance.value?.scaleX(1);
			} else {
				cropperInstance.value?.scaleX(-1);
			}
		}

		if (type === 'horizontal') {
			if (cropperInstance.value?.getData().scaleY === -1) {
				cropperInstance.value?.scaleY(1);
			} else {
				cropperInstance.value?.scaleY(-1);
			}
		}
	}

	function rotate() {
		cropperInstance.value?.rotate(-90);
	}

	function reset() {
		cropperInstance.value?.reset();
		dragMode.value = 'move';
	}
}

function setAspectRatio() {
	if (imageData.value && imageData.value.width && imageData.value.height) {
		aspectRatio.value = imageData.value.width / imageData.value.height;
	}
}

const aspectRatioItems = computed<BoMenuItem[]>(() => {
	const items: BoMenuItem[] = [];

	for (const [index, custom] of (customAspectRatios.value ?? []).entries()) {
		items.push({
			text: custom.text,
			icon: 'aspect_ratio',
			active: aspectRatio.value === custom.value,
			divider: index === customAspectRatios.value!.length - 1,
			onSelect: () => (aspectRatio.value = custom.value),
		});
	}

	const fixed: [string, string, number][] = [
		['16:9', 'crop_16_9', 16 / 9],
		['3:2', 'crop_3_2', 3 / 2],
		['5:4', 'crop_5_4', 5 / 4],
		['7:5', 'crop_7_5', 7 / 5],
		[t('square'), 'crop_square', 1 / 1],
	];

	for (const [text, icon, value] of fixed) {
		items.push({ text, icon, active: aspectRatio.value === value, onSelect: () => (aspectRatio.value = value) });
	}

	items.push({
		text: t('free'),
		icon: 'crop_free',
		active: Number.isNaN(aspectRatio.value),
		onSelect: () => (aspectRatio.value = NaN),
	});

	if (imageData.value && imageData.value.width && imageData.value.height) {
		items.push({
			text: t('original'),
			icon: 'crop_original',
			active: aspectRatio.value === imageData.value.width / imageData.value.height,
			onSelect: setAspectRatio,
		});
	}

	return items;
});

const saveMenuItems = computed<BoMenuItem[]>(() => [
	{ text: t('save_as_new_file'), icon: 'add_photo_alternate', disabled: !hasEdits.value, onSelect: saveAsNew },
]);

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
// TailAdmin segmented control: the pressed tool is a raised white segment.
const PRESSED = 'bg-white text-gray-800 shadow-theme-xs dark:bg-gray-700 dark:text-white';
</script>

<template>
	<BoDrawer
		v-model="internalActive"
		:title="$t('editing_image')"
		icon="tune"
		persistent
		flush
		@cancel="internalActive = false"
		@apply="save"
	>
		<template #activator="activatorBinding">
			<slot name="activator" v-bind="activatorBinding" />
		</template>

		<template #subtitle>
			<p class="m-0 truncate text-theme-xs text-warning-600 dark:text-warning-500">{{ $t('changes_are_permanent') }}</p>
		</template>

		<template #actions>
			<div class="flex items-center">
				<BoButton
					icon="check"
					:class="createAllowed ? 'rounded-e-none' : ''"
					:aria-label="$t('save')"
					:title="$t('save')"
					:loading="saving"
					:disabled="!hasEdits"
					@click="save"
				/>
				<BoMenu v-if="createAllowed" :items="saveMenuItems" align="end">
					<template #trigger>
						<BoButton class="rounded-s-none border-s border-white/20" icon="more_vert" :aria-label="$t('options')" />
					</template>
				</BoMenu>
			</div>
		</template>

		<div v-if="loading" class="flex flex-1 items-center justify-center" aria-busy="true">
			<BoProgressCircular indeterminate :aria-label="$t('loading')" />
		</div>

		<div v-else-if="error || imageError" class="p-6">
			<BoNotice type="danger">{{ $t('unexpected_error') }}</BoNotice>
		</div>

		<div
			v-if="imageData && !loading && !error"
			class="image-editor flex min-h-0 flex-1 flex-col"
			:class="{ 'focal-point': localDragMode === 'focal_point', hidden: imageError }"
		>
			<div class="editor min-h-0 flex-1 bg-gray-900">
				<!-- Backoffice: `crossorigin` keeps the session cookie when the API is another site (cors configuration) and an
				     untainted canvas for the cropped export; Cropper.js keeps the element's value (checkCrossOrigin). -->
				<img
					ref="imageElement"
					:src="imageURL"
					role="presentation"
					alt=""
					crossorigin="use-credentials"
					class="block max-w-full opacity-0"
					@load="onImageLoad"
					@error="imageError = true"
				/>
			</div>

			<div
				role="toolbar"
				:aria-label="$t('editing_image')"
				class="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
			>
				<div class="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
					<BoTooltip :text="$t('move_tool')">
						<button
							type="button"
							:class="[ICON_BTN, { [PRESSED]: localDragMode === 'move' }]"
							:aria-label="$t('move_tool')"
							:aria-pressed="localDragMode === 'move'"
							@click="dragMode = 'move'"
						>
							<BoIcon name="pan_tool" size="sm" />
						</button>
					</BoTooltip>
					<BoTooltip :text="$t('crop_tool')">
						<button
							type="button"
							:class="[ICON_BTN, { [PRESSED]: localDragMode === 'crop' }]"
							:aria-label="$t('crop_tool')"
							:aria-pressed="localDragMode === 'crop'"
							@click="dragMode = 'crop'"
						>
							<BoIcon name="crop" size="sm" />
						</button>
					</BoTooltip>
					<BoTooltip :text="$t('focal_point_tool')">
						<button
							type="button"
							:class="[ICON_BTN, { [PRESSED]: localDragMode === 'focal_point' }]"
							:aria-label="$t('focal_point_tool')"
							:aria-pressed="localDragMode === 'focal_point'"
							@click="dragMode = 'focal_point'"
						>
							<BoIcon name="location_searching" size="sm" />
						</button>
					</BoTooltip>
				</div>

				<BoTooltip :text="$t('rotate')">
					<button type="button" :class="ICON_BTN" :aria-label="$t('rotate')" @click="rotate">
						<BoIcon name="rotate_90_degrees_ccw" size="sm" />
					</button>
				</BoTooltip>

				<BoTooltip :text="$t('flip_horizontal')">
					<button type="button" :class="ICON_BTN" :aria-label="$t('flip_horizontal')" @click="flip('horizontal')">
						<BoIcon name="flip" size="sm" class="rotate-90" />
					</button>
				</BoTooltip>

				<BoTooltip :text="$t('flip_vertical')">
					<button type="button" :class="ICON_BTN" :aria-label="$t('flip_vertical')" @click="flip('vertical')">
						<BoIcon name="flip" size="sm" />
					</button>
				</BoTooltip>

				<BoMenu :items="aspectRatioItems" side="top">
					<template #trigger>
						<button type="button" :class="ICON_BTN" :aria-label="$t('aspect_ratio')" :title="$t('aspect_ratio')">
							<BoIcon :name="aspectRatioIcon" size="sm" />
						</button>
					</template>
				</BoMenu>

				<div class="flex-1" />

				<BoTooltip :text="$t('reset')">
					<button type="button" :class="ICON_BTN" :aria-label="$t('reset')" @click="reset">
						<BoIcon name="restart_alt" size="sm" />
					</button>
				</BoTooltip>

				<p class="dimensions m-0 text-theme-sm tabular-nums text-gray-500 dark:text-gray-400">
					{{ dimensionsString }}
				</p>

				<BoButton v-show="cropping" variant="secondary" @click="cropping = false">
					{{ localDragMode === 'focal_point' ? $t('cancel_selection') : $t('cancel_crop') }}
				</BoButton>
			</div>
		</div>
	</BoDrawer>
</template>

<style>
/* Recipe Q-16: Cropper.js colors from the theme (its CSS uses a fixed blue); the editor area keeps them inside. */
.image-editor .cropper-view-box {
	outline-color: var(--color-brand-500);
}

.image-editor .cropper-line,
.image-editor .cropper-point {
	background-color: var(--color-brand-500);
}

.image-editor .cropper-modal {
	background-color: var(--color-gray-900);
	opacity: 0.6;
}

/* Directus `.focal-point`: the focal point is a round box without handles or guides. */
.image-editor.focal-point .cropper-point.point-nw,
.image-editor.focal-point .cropper-point.point-ne,
.image-editor.focal-point .cropper-point.point-se,
.image-editor.focal-point .cropper-point.point-sw,
.image-editor.focal-point .cropper-dashed,
.image-editor.focal-point .cropper-line {
	display: none;
}

.image-editor.focal-point .cropper-face,
.image-editor.focal-point .cropper-view-box {
	border-radius: 100%;
}
</style>
