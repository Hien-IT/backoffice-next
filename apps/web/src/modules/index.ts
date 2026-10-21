// Ported from directus/app/src/modules/index.ts
// Backoffice: the six internal modules are listed statically (D-41) and app extension modules are added by
// extensions.ts (spec 020); the registered modules live here instead of the extensions store.
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

export function registerModules(initial: ModuleConfig[]): {
	registeredModules: ShallowRef<ModuleConfig[]>;
	onHydrateModules: () => Promise<void>;
	onDehydrateModules: () => Promise<void>;
	setModules: (list: ModuleConfig[]) => void;
	getModules: () => ModuleConfig[];
} {
	// Backoffice (spec 020): the list can be replaced once, before the first hydrate, by the internal modules and those
	// of app extensions (extensions.ts); the shell keeps one registeredModules ref.
	let modules = initial;
	const registeredModules = shallowRef<ModuleConfig[]>([]);
	const removeRoutes: (() => void)[] = [];

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
			// Backoffice: an extension that names a child route after its module id (Directus 11 builds allow it) would make
			// the dev build of vue-router throw; the parent route stays unnamed then, its children keep their names.
			const childNamed = module.routes.some((route) => route.name === module.id);
			removeRoutes.push(
				router.addRoute({
					...(childNamed ? {} : { name: module.id }),
					path: `/${module.id}`,
					component: RouterPass,
					children: module.routes,
				}),
			);
		}
	};

	const onDehydrateModules = async () => {
		for (const remove of removeRoutes.splice(0)) remove();

		registeredModules.value = [];
	};

	// An extension module with the id of an earlier (internal) one is dropped with a warning (R-67).
	const setModules = (list: ModuleConfig[]) => {
		modules = list.filter((module, index) => {
			if (list.findIndex(({ id }) => id === module.id) === index) return true;
			// eslint-disable-next-line no-console
			console.warn(`Module "${module.id}" is already registered`);
			return false;
		});
	};

	return { registeredModules, onHydrateModules, onDehydrateModules, setModules, getModules: () => modules };
}

export const { registeredModules, onHydrateModules, onDehydrateModules, setModules, getModules } =
	registerModules(getInternalModules());
