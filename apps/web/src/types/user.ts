// Ported from directus/app/src/types/user.ts
// Backoffice: @directus/types is not a dependency (FR-002 package rule); only the fields of directus_users the app
// shell reads are typed.
export type ShareUser = {
	share: string;
	admin_access: boolean;
	app_access: boolean;
	role?: { id: string } | null;
};

export type AppUser = {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	avatar: { id: string } | null;
	language: string | null;
	appearance: 'auto' | 'light' | 'dark' | null;
	theme_light: string | null;
	theme_dark: string | null;
	theme_light_overrides: Record<string, unknown> | null;
	theme_dark_overrides: Record<string, unknown> | null;
	text_direction?: 'auto' | 'ltr' | 'rtl' | null;
	tfa_secret: string | null;
	last_page: string | null;
	status: string;
	role: { id: string } | null;
	admin_access: boolean;
	app_access: boolean;
	enforce_tfa: boolean;
	roles: { id: string }[];
	[field: string]: unknown;
};
