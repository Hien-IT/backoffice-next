// Backoffice: the module list of the module bar (moved out of AppSidebar for the top tab bar, D-157). Module list as
// Directus: registeredModules from modules/index.ts (no extensions store); the Documentation link of the Directus
// default is dropped even from a saved module_bar (FR-081, D-49); links to other sites open in a new tab. Modules of app
// extensions are kept apart (D-144): every registered module that is not internal is an extension.
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { DIRECTUS_DOCS_URL, MODULE_BAR_DEFAULT } from '../../constants.ts';
import { getInternalModules, registeredModules } from '../../modules/index.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import { translate } from '../../utils/translate-object-values.ts';

export type ModuleBarItem = { id: string; name: string; icon: string; to?: string; href?: string; extension?: boolean };

const INTERNAL_MODULE_IDS = new Set(getInternalModules().map(({ id }) => id));

export function useModuleBar() {
	const settingsStore = useSettingsStore();
	const userStore = useUserStore();
	const route = useRoute();

	const registeredModuleIDs = computed(() => registeredModules.value.map((module) => module.id));

	const modules = computed<ModuleBarItem[]>(() => {
		// Backoffice: a share session cannot read /settings; it gets the default bar of its registered modules (FR-084).
		const share = !!userStore.currentUser && 'share' in userStore.currentUser;
		if (!settingsStore.settings && !share) return [];

		return (settingsStore.settings?.module_bar ?? MODULE_BAR_DEFAULT)
			.filter((modulePart) => {
				if (modulePart.type === 'link') return !(modulePart.id === 'docs' && modulePart.url === DIRECTUS_DOCS_URL);
				return modulePart.enabled && registeredModuleIDs.value.includes(modulePart.id);
			})
			.map((modulePart) => {
				if (modulePart.type === 'link') {
					const { id, name, icon, url } = modulePart;
					const link: ModuleBarItem = url.startsWith('/') ? { id, name, icon, to: url } : { id, name, icon, href: url };

					return translate(link);
				}

				const module = registeredModules.value.find((module) => module.id === modulePart.id)!;

				return translate({
					id: module.id,
					name: module.name,
					icon: module.icon,
					to: `/${module.id}`,
					extension: !INTERNAL_MODULE_IDS.has(module.id),
				});
			});
	});

	const mainModules = computed(() => modules.value.filter((modulePart) => !modulePart.extension));
	const extensionModules = computed(() => modules.value.filter((modulePart) => modulePart.extension));

	function isActive(item: ModuleBarItem) {
		return item.to !== undefined && (route.path === item.to || route.path.startsWith(`${item.to}/`));
	}

	// The open module, also one without a place in the bar (Activity is `hidden`, as in Directus, spec 018 FR-061):
	// its name heads the sidebar.
	const currentModule = computed<ModuleBarItem | null>(() => {
		const listed = modules.value.find((modulePart) => !modulePart.href && isActive(modulePart));
		if (listed) return listed;

		const module = registeredModules.value.find(({ id }) => route.path === `/${id}` || route.path.startsWith(`/${id}/`));
		return module ? translate({ id: module.id, name: module.name, icon: module.icon }) : null;
	});

	return { modules, mainModules, extensionModules, isActive, currentModule };
}
