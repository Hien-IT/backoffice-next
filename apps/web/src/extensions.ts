// Ported from directus/app/src/extensions.ts
// Backoffice (spec 020, FR-060..FR-069): the app bundle comes from the API of config.json in development too (the
// import map of index.html resolves its shared dependencies, research R4); the registries are the id lookups of
// 013/017/018 with register* added; theme extensions are not registered (D-135, `themes` stays empty).
import type { App } from 'vue';
import { shallowRef, type ShallowRef, watch } from 'vue';
import { getApiUrl } from './api/sdk.ts';
import type { DisplayConfig } from './displays/types.ts';
import type { InterfaceConfig } from './interfaces/types.ts';
import { i18n } from './lang/index.ts';
import type { LayoutConfig } from './layouts/types.ts';
import { getInternalModules, registeredModules, setModules } from './modules/index.ts';
import type { ModuleConfig } from './modules/types.ts';
import type { OperationAppConfig } from './operations/types.ts';
import type { PanelConfig } from './panels/types.ts';
import { translate } from './utils/translate-object-values.ts';

export interface AppExtensionConfigs {
	interfaces: InterfaceConfig[];
	displays: DisplayConfig[];
	layouts: LayoutConfig[];
	modules: ModuleConfig[];
	panels: PanelConfig[];
	operations: OperationAppConfig[];
	themes: unknown[];
}

type RefRecord<T> = { [K in keyof T]: ShallowRef<T[K]> };

let customExtensions: AppExtensionConfigs | null = null;

const extensions: RefRecord<AppExtensionConfigs> = {
	interfaces: shallowRef([]),
	displays: shallowRef([]),
	layouts: shallowRef([]),
	modules: shallowRef([]),
	panels: shallowRef([]),
	operations: shallowRef([]),
	themes: shallowRef([]),
};

export async function loadExtensions(
	load: (url: string) => Promise<AppExtensionConfigs> = (url) => import(/* @vite-ignore */ url),
): Promise<void> {
	try {
		customExtensions = await load(`${getApiUrl()}extensions/sources/index.js`);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.warn(`Couldn't load extensions`);
		// eslint-disable-next-line no-console
		console.warn(err);
	}
}

/** True when the loaded bundle holds app extensions, which need the v-* shim (spec 020, R-62 of research). */
export function hasAppExtensions(): boolean {
	if (!customExtensions) return false;
	const { interfaces, displays, layouts, modules, panels, operations } = customExtensions;
	return [interfaces, displays, layouts, modules, panels, operations].some((list) => list?.length > 0);
}

/**
 * Without app extensions the registries keep their internal configs and nothing is loaded: the registries stay in
 * the lazy chunks of their screens (bundle budget, T116). With app extensions they are loaded and extended here.
 */
export async function registerExtensions(_app?: App): Promise<void> {
	if (!customExtensions || !hasAppExtensions()) return;

	const [interfacesRegistry, displaysRegistry, layoutsRegistry, panelsRegistry, operationsRegistry] = await Promise.all(
		[
			import('./interfaces/index.ts'),
			import('./displays/index.ts'),
			import('./layouts/index.ts'),
			import('./panels/index.ts'),
			import('./operations/index.ts'),
		],
	);

	const interfaces = [...interfacesRegistry.getInternalInterfaces(), ...(customExtensions.interfaces ?? [])];
	const displays = [...displaysRegistry.getInternalDisplays(), ...(customExtensions.displays ?? [])];
	const layouts = [...layoutsRegistry.getInternalLayouts(), ...(customExtensions.layouts ?? [])];
	const modules = [...getInternalModules(), ...(customExtensions.modules ?? [])];
	const panels = [...panelsRegistry.getInternalPanels(), ...(customExtensions.panels ?? [])];
	const operations = [...operationsRegistry.getInternalOperations(), ...(customExtensions.operations ?? [])];

	interfacesRegistry.registerInterfaces(interfaces);
	displaysRegistry.registerDisplays(displays);
	layoutsRegistry.registerLayouts(layouts);
	panelsRegistry.registerPanels(panels);
	operationsRegistry.registerOperations(operations);
	setModules(modules);

	watch(
		i18n.global.locale,
		() => {
			extensions.interfaces.value = translate(interfaces);
			extensions.displays.value = translate(displays);
			extensions.layouts.value = translate(layouts);
			extensions.panels.value = translate(panels);
			extensions.operations.value = translate(operations);
		},
		{ immediate: true },
	);

	watch(
		[i18n.global.locale, registeredModules],
		() => (extensions.modules.value = translate(registeredModules.value)),
		{
			immediate: true,
		},
	);
}

export function useExtensions(): RefRecord<AppExtensionConfigs> {
	return extensions;
}
