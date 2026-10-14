<!-- Ported from directus/app/src/views/private/components/file-lightbox.vue -->
<script setup lang="ts">
// Backoffice: Lightbox recipe (component-specs Tier 3) on a Reka Dialog (focus trap, Esc, focus return); a header with
// the file title, a download link and a labelled close button (Directus has only an unlabelled close button).
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed } from 'vue';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import BoIcon from '../BoIcon.vue';
import FilePreview, { type Props as FilePreviewProps } from './FilePreview.vue';

interface Props extends FilePreviewProps {
	modelValue: boolean;
	src?: string | undefined;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
}>();

const internalModelValue = computed({
	get: () => props.modelValue,
	set: (value: boolean) => emit('update:modelValue', value),
});

const downloadUrl = computed(() => (props.file.id ? getAssetUrl(props.file.id, { isDownload: true }) : null));

const BUTTON =
	'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<slot name="activator" v-bind="{ on: () => (internalModelValue = true) }" />

	<DialogRoot v-model:open="internalModelValue">
		<DialogPortal>
			<DialogOverlay class="fixed inset-0 z-99999" />
			<DialogContent
				:aria-describedby="undefined"
				class="fixed inset-0 z-99999 flex flex-col bg-gray-900/95 text-white outline-hidden"
			>
				<div class="flex items-center justify-between gap-3 px-4 py-3">
					<DialogTitle class="m-0 min-w-0 truncate text-sm font-medium text-white">
						{{ file.title }}
					</DialogTitle>
					<div class="flex shrink-0 items-center gap-2">
						<a v-if="downloadUrl" :href="downloadUrl" download :aria-label="$t('download')" :class="BUTTON">
							<BoIcon name="download" />
						</a>
						<DialogClose :aria-label="$t('close')" :class="BUTTON">
							<BoIcon name="close" />
						</DialogClose>
					</div>
				</div>
				<div class="min-h-0 flex-1 p-4">
					<FilePreview :file="file" :src="src" :preset="null" in-modal @click="internalModelValue = false" />
				</div>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>
</template>
