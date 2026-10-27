// Ported from directus/packages/types/src/permissions.ts
import { PERMISSION_ACTIONS } from '@backoffice/constants';
import type { Filter } from './filter.js';

export type PermissionsAction = (typeof PERMISSION_ACTIONS)[number];

export type Permission = {
	id?: number;
	policy: string | null;
	collection: string;
	action: PermissionsAction;
	permissions: Filter | null;
	validation: Filter | null;
	presets: Record<string, any> | null;
	fields: string[] | null;
	system?: true;
};

export type ItemPermissions = {
	update: { access: boolean; presets?: Permission['presets']; fields?: Permission['fields'] };
	delete: { access: boolean };
	share: { access: boolean };
};

export type CollectionPermissions = {
	[action in PermissionsAction]: {
		access: 'none' | 'partial' | 'full';
		fields?: string[];
		presets?: Record<string, any>;
	};
} & {
	// Backoffice (spec 025, D-189): the import and export actions of backoffice_permissions; `formats` absent = all.
	import?: { access: 'none' | 'partial' | 'full'; fields?: string[]; formats?: string[] };
	export?: { access: 'none' | 'partial' | 'full'; fields?: string[]; formats?: string[] };
};

/** Backoffice (spec 025): a row of backoffice_permissions (the columns of directus_permissions plus `options`). */
export type BackofficePermission = {
	id?: number;
	policy: string;
	collection: string | null;
	action: string;
	permissions: Filter | null;
	validation: Filter | null;
	presets: Record<string, any> | null;
	fields: string[] | null;
	options: { formats?: string[] } | null;
};

export type CollectionAccess = {
	[collection: string]: CollectionPermissions;
};

export type GlobalAccess = {
	admin: boolean;
	app: boolean;
};
