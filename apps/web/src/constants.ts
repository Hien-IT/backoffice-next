// Ported from directus/app/src/constants.ts
// Backoffice: only the constants the app shell, the form and the interfaces use; DIRECTUS_LOGO dropped (FR-083); RTL_LANGUAGES from
// constants/text-direction.ts.
import type { Type } from '@directus/types';

export const DRAFT_VERSION_KEY = 'draft';

export const VALIDATION_TYPES = ['FAILED_VALIDATION', 'RECORD_NOT_UNIQUE'];

export const APP_NUMERIC_TYPES = ['integer', 'float'];
/** Treat `bigInteger` and `decimal` as strings to avoid rounding errors. */
export const APP_NUMERIC_STRING_TYPES = ['bigInteger', 'decimal'];

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

/** Feature 016: the field type choices of the Settings forms (list options, inline fields). */
export const FIELD_TYPES_SELECT: Array<{ value: Type; text: string } | { divider: true }> = [
	{
		text: '$t:string',
		value: 'string',
	},
	{
		text: '$t:text',
		value: 'text',
	},
	{ divider: true },
	{
		text: '$t:boolean',
		value: 'boolean',
	},
	{ divider: true },
	{
		text: '$t:integer',
		value: 'integer',
	},
	{
		text: '$t:bigInteger',
		value: 'bigInteger',
	},
	{
		text: '$t:float',
		value: 'float',
	},
	{
		text: '$t:decimal',
		value: 'decimal',
	},
	{ divider: true },
	{
		text: '$t:geometry.All',
		value: 'geometry',
	},
	{ divider: true },
	{
		text: '$t:timestamp',
		value: 'timestamp',
	},
	{
		text: '$t:datetime',
		value: 'dateTime',
	},
	{
		text: '$t:date',
		value: 'date',
	},
	{
		text: '$t:time',
		value: 'time',
	},
	{ divider: true },
	{
		text: '$t:json',
		value: 'json',
	},
	{
		text: '$t:csv',
		value: 'csv',
	},
	{
		text: '$t:uuid',
		value: 'uuid',
	},
	{
		text: '$t:hash',
		value: 'hash',
	},
];
