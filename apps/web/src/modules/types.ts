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

/** Module routes of feature 012: the module root and every sub path show the module frame (FR-023, D-40). */
export function placeholderRoutes(id: string): RouteRecordRaw[] {
	const component = () => import('./ModulePlaceholder.vue');

	return [
		{ name: `${id}-root`, path: '', component, meta: { module: id } },
		{ name: `${id}-any`, path: ':pathMatch(.*)*', component, meta: { module: id } },
	];
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
