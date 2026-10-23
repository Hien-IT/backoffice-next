<!-- Ported from directus/app/src/views/private/components/file-preview.vue -->
<script setup lang="ts">
// Backoffice: Image preview recipe (component-specs Tier 3). Outside a modal the click target is a button (keyboard
// path to the lightbox); in a modal the whole preview emits click like DR, except the native media controls.
// The image loads with `loading="lazy"` instead of v-image's IntersectionObserver + request queue; loading and error
// states come from the recipe (DR shows none).
import type { File } from '@directus/types';
import { computed, ref, toRef, watch } from 'vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { readableMimeType } from '../../utils/readable-mime-type.ts';
import BoIcon from '../BoIcon.vue';

export interface Props {
	file: Pick<File, 'id' | 'title' | 'type' | 'modified_on' | 'width' | 'height'>;
	preset?: string | null;
	inModal?: boolean;
	disabled?: boolean;
	nonEditable?: boolean;
	/** Direct source URL, bypasses asset URL computation from file.id */
	src?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), { preset: 'system-large-contain', src: undefined });

const emit = defineEmits<{
	click: [];
}>();

const file = toRef(props, 'file');

const src = computed(() => {
	if (props.src) return props.src;

	// Backoffice: no `imageKey: undefined` key (exactOptionalPropertyTypes).
	return getAssetUrl(file.value.id, {
		...(props.preset && { imageKey: props.preset }),
		cacheBuster: file.value.modified_on,
	});
});

const type = computed<'image' | 'video' | 'audio' | string>(() => {
	const mimeType = file.value.type;

	if (mimeType === null) return 'unknown';

	if (mimeType.startsWith('image')) {
		return 'image';
	}

	if (mimeType.startsWith('video')) {
		return 'video';
	}

	if (mimeType.startsWith('audio')) {
		return 'audio';
	}

	return readableMimeType(mimeType, true) ?? 'unknown';
});

const isSVG = computed(() => file.value.type?.includes('svg'));

const maxHeight = computed(() => (props.inModal ? '85vh' : Math.min(file.value.height ?? 528, 528) + 'px'));
const isSmall = computed(() => file.value.height && file.value.height < 528);

const imageState = ref<'loading' | 'loaded' | 'error'>('loading');
watch(src, () => (imageState.value = 'loading'));

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="file-preview relative"
		:class="inModal ? 'flex h-full w-full items-center justify-center' : 'max-w-full'"
		:data-type="type"
		@click="inModal && emit('click')"
	>
		<component
			:is="inModal ? 'div' : 'button'"
			v-if="type !== 'video' && type !== 'audio'"
			v-bind="inModal ? {} : { type: 'button', disabled }"
			class="block rounded-xl"
			:class="[inModal ? 'max-h-full max-w-full' : `w-full cursor-zoom-in disabled:cursor-default ${FOCUS}`]"
			@click="!inModal && emit('click')"
		>
			<div
				v-if="type === 'image'"
				class="image overflow-hidden"
				:class="[
					inModal ? '' : 'rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5',
					{
						'p-14': !inModal && (isSVG || isSmall),
						'animate-pulse motion-reduce:animate-none': imageState === 'loading',
					},
				]"
			>
				<div
					v-if="imageState === 'error'"
					class="flex flex-col items-center justify-center gap-2 py-8 text-gray-500 dark:text-gray-400"
				>
					<BoIcon name="broken_image" size="lg" />
					<span class="text-theme-sm">{{ $t('image_load_error') }}</span>
				</div>
				<img
					v-else
					class="mx-auto block h-auto w-auto max-w-full object-contain"
					:class="{ 'rounded-xl': !inModal }"
					:src="src"
					:width="file.width ?? undefined"
					:height="file.height ?? undefined"
					:alt="file.title ?? ''"
					:style="{ maxHeight }"
					loading="lazy"
					@load="imageState = 'loaded'"
					@error="imageState = 'error'"
				/>
			</div>

			<div
				v-else
				class="fallback flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5"
			>
				<BoIcon name="insert_drive_file" size="sm" class="text-gray-500 dark:text-gray-400" />
				<span class="text-theme-xs font-medium uppercase text-gray-700 dark:text-gray-400">{{ type }}</span>
			</div>
		</component>

		<div
			v-else-if="type === 'video'"
			class="video flex justify-center rounded-xl"
			:class="{ 'bg-gray-100 dark:bg-white/5': !inModal }"
		>
			<video
				controls
				:src="src"
				class="h-auto min-h-18 w-auto min-w-18 max-w-full rounded-xl object-contain"
				:style="{ maxHeight }"
				@click.stop
			/>
		</div>

		<audio v-else controls :src="src" class="w-full max-w-full" @click.stop />
	</div>
</template>
