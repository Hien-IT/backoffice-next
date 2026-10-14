// Ported from directus/app/src/stores/server.ts
// Backoffice: requests go through the SDK client; mcp_enabled, ai_enabled, files, extensions and uploads are not
// read (D-41, Principle XI).
import formatTitle from '@directus/format-title';
import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import { apiFetch, replaceQueue, requestEndpoint, sdk } from '../api/sdk.ts';
import { AUTH_SSO_DRIVERS, DEFAULT_AUTH_DRIVER, DEFAULT_AUTH_PROVIDER } from '../constants.ts';
import { i18n } from '../lang/index.ts';
import type { AuthProvider } from '../types/login.ts';

export type Info = {
	project: null | {
		project_name: string | null;
		project_descriptor: string | null;
		project_logo: string | null;
		project_color: string | null;
		default_language: string | null;
		default_appearance: 'light' | 'dark' | 'auto';
		default_theme_light: string | null;
		default_theme_dark: string | null;
		theme_light_overrides: Record<string, unknown> | null;
		theme_dark_overrides: Record<string, unknown> | null;
		public_foreground: string | null;
		public_background: { id: string; type: string } | null;
		public_favicon: string | null;
		public_note: string | null;
		custom_css: string | null;
		public_registration: boolean | null;
		public_registration_verify_email: boolean | null;
	};
	setupCompleted: boolean;
	rateLimit?:
		| false
		| {
				points: number;
				duration: number;
		  }
		| undefined;
	queryLimit?:
		| {
				default: number;
				max: number;
		  }
		| undefined;
	websocket?: false | Record<string, unknown> | undefined;
	version?: string | undefined;
};

export type Auth = {
	providers: AuthProvider[];
	disableDefault: boolean;
};

type ServerInfoResponse = Partial<Info> & Record<string, unknown>;

/**
 * Backoffice (D-51): the column defaults Directus writes in every database (its project name and purple project
 * color) count as unset, so the app shows Backoffice and the design-system primary until an admin sets its own
 * values. Display only: nothing is written back.
 */
export function withoutDirectusDefaults(project: Info['project']): Info['project'] {
	if (!project) return project;

	return {
		...project,
		project_name: project.project_name === 'Directus' ? null : project.project_name, // brand-allowed: D-51 data
		project_color: project.project_color?.toLowerCase() === '#6644ff' ? null : project.project_color, // raw-color-allowed: D-51 data
	};
}
type AuthResponse = { data: AuthProvider[]; disableDefault: boolean };

export const useServerStore = defineStore('serverStore', () => {
	const info = reactive<Info>({
		project: null,
		setupCompleted: false,
		rateLimit: undefined,
		queryLimit: undefined,
		websocket: undefined,
	});

	const auth = reactive<Auth>({
		providers: [],
		disableDefault: false,
	});

	const providerOptions = computed(() => {
		const options = auth.providers
			.filter((provider) => !AUTH_SSO_DRIVERS.includes(provider.driver))
			.map((provider) => ({ text: formatTitle(provider.name), value: provider.name, driver: provider.driver }));

		if (!auth.disableDefault) {
			options.unshift({
				text: i18n.global.t('default_provider'),
				value: DEFAULT_AUTH_PROVIDER,
				driver: DEFAULT_AUTH_DRIVER,
			});
		}

		return options;
	});

	const hydrate = async () => {
		const [serverInfo, authResponse] = await Promise.all([
			sdk.request(requestEndpoint<ServerInfoResponse>('/server/info', { method: 'GET' })),
			// Backoffice: the SDK keeps only `data`, and disableDefault sits next to it, so read the raw answer.
			apiFetch('/auth?sessionOnly').then(async (response) => {
				const body = await response.json();
				if (!response.ok) throw body;
				return body as AuthResponse;
			}),
		]);

		info.project = withoutDirectusDefaults(serverInfo?.project ?? null);
		info.setupCompleted = serverInfo?.setupCompleted ?? false;
		info.queryLimit = serverInfo?.queryLimit;
		info.websocket = serverInfo?.websocket;
		info.version = serverInfo?.version;

		auth.providers = authResponse?.data ?? [];
		auth.disableDefault = authResponse?.disableDefault ?? false;

		if (serverInfo?.rateLimit !== undefined) {
			if (serverInfo.rateLimit === false) {
				await replaceQueue();
			} else {
				const { duration, points } = serverInfo.rateLimit;
				const intervalCap = 1;
				/** Interval for 1 point */
				const interval = Math.ceil((duration * 1000) / points);
				await replaceQueue({ intervalCap, interval });
			}
		}
	};

	const dehydrate = () => {
		info.project = null;

		auth.providers = [];
		auth.disableDefault = false;
	};

	return { info, auth, providerOptions, hydrate, dehydrate };
});
