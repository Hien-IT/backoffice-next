// Ported from directus/packages/types/src/settings.ts (subset: OwnerInformation, feature 010)
export type OwnerInformation = {
	project_owner: string | null;
	project_usage: 'personal' | 'commercial' | 'community' | null;
	org_name: string | null;
	product_updates: boolean;
};
