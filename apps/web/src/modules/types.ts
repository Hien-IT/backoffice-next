// Ported from directus/app/src/modules/index.ts
// Backoffice: the ModuleConfig fields of @directus/extensions the app shell uses (data-model §Module).
import type { RouteRecordRaw } from 'vue-router';
import type { CollectionAccess } from '../stores/permissions.ts';
import type { AppUser, ShareUser } from '../types/user.ts';

export interface ModuleConfig {
	id: string;
	name: string;
	icon: string;
	hidden?: boolean;
	routes: RouteRecordRaw[];
	preRegisterCheck?: (user: AppUser | ShareUser, permissions: CollectionAccess) => boolean | Promise<boolean>;
}

export function defineModule(config: ModuleConfig): ModuleConfig {
	return config;
}

/** Admin or partial/full read access to a collection (the preRegisterCheck of files, users, insights). */
export function canRead(collection: string) {
	return (user: AppUser | ShareUser, permissions: CollectionAccess): boolean => {
		const admin = user.admin_access;
		if (admin) return true;

		const access = permissions[collection]?.['read']?.access;
		return access === 'partial' || access === 'full';
	};
}
