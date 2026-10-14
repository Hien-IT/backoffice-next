<script setup lang="ts">
// Layout of directus/app/src/views/public/public-view.vue rewritten with the eh-* utilities (contracts/ui-routes §5).
// Backoffice: the default logo is the Backoffice SVG (light/dark by the `dark` class, FR-030); the logo box uses
// --project-color set by the app head (FR-031); a background video does not autoplay under reduced motion (D-50).
import { useMediaQuery } from '@vueuse/core';
import { computed, ref, useTemplateRef } from 'vue';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import BoButton from '../components/BoButton.vue';
import { useServerStore } from '../stores/server.ts';
import { getAssetUrl } from '../utils/get-asset-url.ts';
import { md } from '../utils/markdown.ts';

const serverStore = useServerStore();

// /server/info may have no project (FR-037): every value falls back to a default.
const project = computed(() => serverStore.info.project);
const projectName = computed(() => project.value?.project_name || 'Backoffice');

const logoURL = computed(() => (project.value?.project_logo ? getAssetUrl(project.value.project_logo) : null));

const customBackgroundIsVideo = computed(() => project.value?.public_background?.type?.startsWith('video/') ?? false);

const customBackgroundUrl = computed(() =>
	project.value?.public_background ? getAssetUrl(project.value.public_background.id) : null,
);

const artStyles = computed(() =>
	customBackgroundUrl.value && !customBackgroundIsVideo.value
		? { backgroundImage: `url("${customBackgroundUrl.value}")` }
		: {},
);

const foregroundURL = computed(() =>
	project.value?.public_foreground ? getAssetUrl(project.value.public_foreground) : null,
);

// The only v-html of the app: markdown sanitized by DOMPurify (spec "Bảo mật").
const note = computed(() => (project.value?.public_note ? md(project.value.public_note) : null));

const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const video = useTemplateRef<HTMLVideoElement>('video');
const videoStarted = ref(false);

function playVideo() {
	videoStarted.value = true;
	video.value?.play();
}
</script>

<template>
	<div class="flex h-dvh w-full bg-eh-surface-subtle text-eh-text-primary">
		<div
			class="z-2 flex h-full w-full max-w-[28.125rem] shrink-0 flex-col justify-between overflow-y-auto bg-eh-surface-default p-eh-5 text-eh-sm shadow-eh-sm min-[28.125rem]:px-eh-12 min-[28.125rem]:py-eh-8"
		>
			<div class="flex max-w-full items-center gap-eh-3" data-testid="public-title">
				<div class="flex size-[3.125rem] shrink-0 items-center justify-center rounded-eh-md bg-project">
					<img v-if="logoURL" :src="logoURL" :alt="projectName" class="size-[2.25rem] object-contain" />
					<template v-else>
						<img :src="logoLight" :alt="projectName" class="size-[2.25rem] dark:hidden" />
						<img :src="logoDark" :alt="projectName" class="hidden size-[2.25rem] dark:block" />
					</template>
				</div>
				<div class="min-w-0">
					<p class="truncate text-eh-base font-bold" :title="projectName">{{ projectName }}</p>
					<p class="truncate text-eh-text-secondary">
						{{ project?.project_descriptor ?? $t('application') }}
					</p>
				</div>
			</div>

			<div class="w-[19.125rem] max-w-full py-eh-8">
				<slot />
			</div>

			<div class="flex items-center gap-eh-1 text-eh-text-secondary">
				<slot name="notice" />
			</div>
		</div>

		<div
			class="relative z-1 hidden h-full grow items-center justify-center bg-cover bg-center sm:flex"
			data-testid="public-art"
			:style="artStyles"
		>
			<div v-if="!customBackgroundUrl" class="absolute inset-0 -z-1 overflow-hidden bg-eh-surface-subtle">
				<div class="absolute -bottom-1/4 -left-1/4 h-1/2 w-1/2 rounded-eh-full bg-project opacity-50 blur-3xl" />
				<div class="absolute -bottom-1/4 left-[15%] h-2/5 w-3/5 rounded-eh-full bg-project opacity-70 blur-3xl" />
				<div class="absolute -bottom-1/5 left-3/4 h-1/5 w-2/5 rounded-eh-full bg-project opacity-60 blur-2xl" />
			</div>

			<template v-else-if="customBackgroundIsVideo">
				<video
					ref="video"
					:src="customBackgroundUrl"
					:autoplay="!reducedMotion"
					muted
					loop
					playsinline
					aria-hidden="true"
					class="absolute inset-0 -z-1 size-full object-cover"
				/>
				<BoButton
					v-if="reducedMotion && !videoStarted"
					variant="secondary"
					icon="play_arrow"
					:aria-label="$t('play_video')"
					class="absolute top-eh-4 right-eh-4"
					@click="playVideo"
				/>
			</template>

			<img v-if="foregroundURL" :src="foregroundURL" :alt="project?.project_name ?? ''" class="w-4/5 max-w-[22.5rem]" />

			<div v-if="note" class="absolute inset-x-0 bottom-eh-8 flex justify-center px-eh-4">
				<!-- sanitized by md() (DOMPurify) -->
				<!-- eslint-disable vue/no-v-html -->
				<div
					class="max-w-[19.125rem] rounded-eh-md bg-eh-neutral-900/20 px-eh-3 py-eh-2 text-eh-sm wrap-break-word text-eh-neutral-0 backdrop-blur-xs"
					data-testid="public-note"
					v-html="note"
				/>
				<!-- eslint-enable vue/no-v-html -->
			</div>
		</div>
	</div>
</template>
