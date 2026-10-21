// Ported from directus/packages/types/src/settings.ts (subset: OwnerInformation, feature 010; SettingsModuleBarModule,
// SettingsModuleBarLink, feature 021 for the ported migration 20250224A)
export type OwnerInformation = {
	project_owner: string | null;
	project_usage: 'personal' | 'commercial' | 'community' | null;
	org_name: string | null;
	product_updates: boolean;
};

export type SettingsModuleBarModule = {
	type: 'module';
	id: string;
	enabled: boolean;
	locked?: boolean;
};

export type SettingsModuleBarLink = {
	type: 'link';
	id: string;
	url: string;
	icon: string;
	name: string;
	enabled: boolean;
	locked?: boolean;
};
