<script setup lang="ts">
// Content of directus/app/src/views/public/public-view.vue (contracts/ui-routes §5) as a centered card over a full-page
// background (owner's choice 2026-10-15, design-system/docs/layout-patterns.md "Public pages"): the background is
// public_background (image or video) or the project color with the TailAdmin grid shapes.
// Backoffice: the default logo is the Backoffice SVG (light/dark by the `dark` class, FR-030); the logo box uses
// --project-color set by the app head (FR-031); a background video does not autoplay under reduced motion (D-50).
import { useMediaQuery } from '@vueuse/core';
import { computed, ref, useTemplateRef } from 'vue';
import logo from '../assets/logo.png';
import BoButton from '../components/BoButton.vue';
import { useServerStore } from '../stores/server.ts';
import { getAssetUrl } from '../utils/get-asset-url.ts';
import { md } from '../utils/markdown.ts';

defineProps<{
	/** Spec 020 (Q-45): the wider form column of the DR `wide` public view (40 rem). */
	wide?: boolean;
	/** The DR shared view of extensions: a 48.125rem column whose wide content scrolls (shared-view.vue:62-81). */
	shared?: boolean;
}>();

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
	<div class="relative isolate flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 text-sm">
		<div
			class="absolute inset-0 -z-1 overflow-hidden bg-(--project-color) bg-cover bg-center"
			data-testid="public-art"
			:style="artStyles"
		>
			<!-- TailAdmin CommonGridShape (grid-01.svg) drawn with theme colors: top end and, turned, bottom start. -->
			<template v-if="!customBackgroundUrl">
				<div
					v-for="corner in ['top-0 end-0', 'bottom-0 start-0 rotate-180']"
					:key="corner"
					aria-hidden="true"
					class="absolute aspect-450/254 w-full max-w-[250px] bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-size-[51px_52px] text-white/30 mask-b-from-10% mask-l-from-10% xl:max-w-[450px]"
					:class="corner"
				/>
			</template>

			<video
				v-else-if="customBackgroundIsVideo"
				ref="video"
				:src="customBackgroundUrl"
				:autoplay="!reducedMotion"
				muted
				loop
				playsinline
				aria-hidden="true"
				class="absolute inset-0 size-full object-cover"
			/>
		</div>

		<BoButton
			v-if="customBackgroundIsVideo && reducedMotion && !videoStarted"
			variant="secondary"
			icon="play_arrow"
			:aria-label="$t('play_video')"
			class="absolute end-4 top-4"
			@click="playVideo"
		/>

		<img
			v-if="foregroundURL"
			:src="foregroundURL"
			:alt="project?.project_name ?? ''"
			class="mb-6 max-h-24 w-auto max-w-xs object-contain"
		/>

		<div
			class="w-full rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
			:class="shared ? 'max-w-[48.125rem] overflow-auto' : ['overflow-hidden', wide ? 'max-w-160' : 'max-w-md']"
		>
			<div class="px-6 pt-8 sm:px-10">
				<div class="flex items-center gap-3" data-testid="public-title">
					<!-- The default app icon (owner 2026-10-22, D-159) shows as is, without the project color tile. -->
					<div
						class="flex size-12 shrink-0 items-center justify-center rounded-xl"
						:class="{ 'bg-(--project-color)': logoURL }"
					>
						<img v-if="logoURL" :src="logoURL" :alt="projectName" class="size-9 object-contain" />
						<img v-else :src="logo" :alt="projectName" class="size-12 object-contain" />
					</div>
					<div class="min-w-0">
						<p class="truncate text-base font-semibold text-gray-800 dark:text-white/90" :title="projectName">
							{{ projectName }}
						</p>
						<p class="truncate text-gray-500 dark:text-gray-400">
							{{ project?.project_descriptor ?? $t('application') }}
						</p>
					</div>
				</div>
			</div>

			<div class="px-6 py-8 sm:px-10">
				<slot />
			</div>

			<div
				class="flex items-center justify-center gap-1 border-t border-gray-200 bg-gray-50 px-6 py-4 text-gray-500 sm:px-10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
			>
				<slot name="notice" />
			</div>
		</div>

		<div v-if="note" class="mt-6 flex w-full max-w-md justify-center">
			<!-- sanitized by md() (DOMPurify) -->
			<!-- eslint-disable vue/no-v-html -->
			<div
				class="rounded-lg bg-gray-900/80 px-3 py-2 text-sm wrap-break-word text-white backdrop-blur-xs [&_a]:rounded-sm [&_a]:underline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-white"
				data-testid="public-note"
				v-html="note"
			/>
			<!-- eslint-enable vue/no-v-html -->
		</div>
	</div>
</template>
