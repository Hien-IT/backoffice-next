// Ported from directus/app/src/app.vue (useHead)
// Backoffice: default name Backoffice and the design-system primary instead of the Directus name and color (D-39);
// project_color only when the browser reads it as a color (spec release-gate clarifications, CHK067); the default
// favicon lives under /admin/. The dark/light class comes with the theme (tasks T057).
import { useHead } from '@unhead/vue';
import { computed } from 'vue';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';
import { cssVar } from '../utils/css-var.ts';
import { generateFavicon } from '../utils/generate-favicon.ts';
import { getAssetUrl } from '../utils/get-asset-url.ts';

export const DEFAULT_PROJECT_NAME = 'Backoffice';
export const DEFAULT_FAVICON = '/admin/favicon.ico';

/** project_color when it is a valid CSS color, null otherwise (a broken value must not break the head style). */
export function safeColor(color: string | null | undefined): string | null {
	// The character check keeps the head style intact even where CSS.supports is lenient (test DOMs).
	if (!color || /[;{}<>]/.test(color)) return null;
	return CSS.supports('color', color) ? color : null;
}

export function useAppHead() {
	const serverStore = useServerStore();
	const userStore = useUserStore();

	const projectColor = computed(() => safeColor(serverStore.info?.project?.project_color));

	const brandStyleCss = computed(() => {
		return `:root { --project-color: ${projectColor.value ?? 'var(--eh-color-action-primary)'} }`;
	});

	useHead({
		style: [{ textContent: brandStyleCss }],
		title: DEFAULT_PROJECT_NAME,
		titleTemplate: '%s · %projectName',
		templateParams: {
			projectName: computed(() => serverStore.info?.project?.project_name ?? DEFAULT_PROJECT_NAME),
		},
		htmlAttrs: computed(() => ({
			lang: userStore.language,
			dir: userStore.textDirection,
		})),
		meta: computed(() => {
			const content = projectColor.value ?? cssVar('--eh-color-action-primary', document.documentElement);

			return [
				{
					name: 'msapplication-TileColor',
					content,
				},
				{
					name: 'theme-color',
					content,
				},
			];
		}),
		link: computed(() => {
			let href: string;

			if (serverStore.info?.project?.public_favicon) {
				href = getAssetUrl(serverStore.info.project.public_favicon);
			} else if (projectColor.value) {
				href = generateFavicon(projectColor.value, !!serverStore.info.project?.project_logo === false);
			} else {
				href = DEFAULT_FAVICON;
			}

			return [
				{
					rel: 'icon',
					href,
				},
			];
		}),
	});

	const customCSS = computed(() => {
		return serverStore.info?.project?.custom_css || '';
	});

	return { customCSS };
}
