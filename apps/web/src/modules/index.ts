// Ported from directus/app/src/modules/index.ts
// Backoffice: the six internal modules are listed statically (no extensions, D-41); the registered modules live
// here instead of the extensions store.
import { sortBy } from 'lodash-es';
import { shallowRef, type ShallowRef } from 'vue';
import { router } from '../router/index.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { useUserStore } from '../stores/user.ts';
import RouterPass from '../utils/router-passthrough.ts';
import activity from './activity.ts';
import content from './content.ts';
import files from './files.ts';
import insights from './insights.ts';
import settings from './settings.ts';
import type { ModuleConfig } from './types.ts';
import users from './users.ts';

export type { ModuleConfig } from './types.ts';

export function getInternalModules(): ModuleConfig[] {
	return sortBy([activity, content, files, insights, settings, users], 'id');
}

export function registerModules(modules: ModuleConfig[]): {
	registeredModules: ShallowRef<ModuleConfig[]>;
	onHydrateModules: () => Promise<void>;
	onDehydrateModules: () => Promise<void>;
} {
	const registeredModules = shallowRef<ModuleConfig[]>([]);

	const onHydrateModules = async () => {
		const userStore = useUserStore();
		const permissionsStore = usePermissionsStore();

		if (!userStore.currentUser) return;

		registeredModules.value = (
			await Promise.all(
				modules.map(async (module) => {
					if (!module.preRegisterCheck) return module;

					const allowed = await module.preRegisterCheck(userStore.currentUser!, permissionsStore.permissions);

					if (allowed) return module;

					return null;
				}),
			)
		).filter((module): module is ModuleConfig => module !== null);

		for (const module of registeredModules.value) {
			router.addRoute({
				name: module.id,
				path: `/${module.id}`,
				component: RouterPass,
				children: module.routes,
			});
		}
	};

	const onDehydrateModules = async () => {
		for (const module of modules) {
			if (router.hasRoute(module.id)) router.removeRoute(module.id);
		}

		registeredModules.value = [];
	};

	return { registeredModules, onHydrateModules, onDehydrateModules };
}

export const { registeredModules, onHydrateModules, onDehydrateModules } = registerModules(getInternalModules());
