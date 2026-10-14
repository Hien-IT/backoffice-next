// Ported from directus/app/src/constants.ts
// Backoffice: only the constants the app shell uses; DIRECTUS_LOGO dropped (FR-083); RTL_LANGUAGES from
// constants/text-direction.ts.

export const VALIDATION_TYPES = ['FAILED_VALIDATION', 'RECORD_NOT_UNIQUE'];

export type ModuleBarModule = { type: 'module'; id: string; enabled: boolean; locked?: boolean };
export type ModuleBarLink = { type: 'link'; id: string; enabled: boolean; name: string; icon: string; url: string };
export type ModuleBarPart = ModuleBarModule | ModuleBarLink;

/** URL of the Documentation link of the Directus default module bar; hidden even in a saved module_bar (FR-081). */
export const DIRECTUS_DOCS_URL = 'https://docs.directus.io';

export const MODULE_BAR_DEFAULT: ModuleBarPart[] = [
	{
		type: 'module',
		id: 'content',
		enabled: true,
	},
	{
		type: 'module',
		id: 'visual',
		enabled: false,
	},
	{
		type: 'module',
		id: 'users',
		enabled: true,
	},
	{
		type: 'module',
		id: 'files',
		enabled: true,
	},
	{
		type: 'module',
		id: 'insights',
		enabled: true,
	},
	{
		type: 'module',
		id: 'deployments',
		enabled: false,
	},
	// Backoffice: the { type: 'link', id: 'docs' } entry to https://docs.directus.io is left out (D-49, FR-081)
	{
		type: 'module',
		id: 'settings',
		enabled: true,
		locked: true,
	},
];

// Keep in sync with --breakpoint-* in src/styles/theme.css
export const BREAKPOINTS = {
	sm: '640px',
	lg: '1024px',
	xl: '1280px',
};

export const DEFAULT_AUTH_PROVIDER = 'local';
export const DEFAULT_AUTH_DRIVER = 'default';

export const AUTH_SSO_DRIVERS = ['oauth2', 'openid', 'saml'];

export const SDK_AUTH_REFRESH_BEFORE_EXPIRES = 10_000;

/**
 * Languages that Directus currently supports that are commonly written RTL
 */
export const RTL_LANGUAGES = ['ar-SA', 'fa-IR', 'he-IL'] as const;
