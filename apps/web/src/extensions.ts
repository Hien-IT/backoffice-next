// Ported from directus/app/src/extensions.ts
// Backoffice (spec 020, FR-060..FR-069): the app bundle comes from the API of config.json in development too (the
// import map of index.html resolves its shared dependencies, research R4); the registries are the id lookups of
// 013/017/018 with register* added; theme extensions are not registered (D-135, `themes` stays empty).
import type { App } from 'vue';
import { type Component, defineComponent, h, shallowRef, type ShallowRef, watch } from 'vue';
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
export async function registerExtensions(app?: App): Promise<void> {
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

	const interfaces = [
		...interfacesRegistry.getInternalInterfaces(),
		...(customExtensions.interfaces ?? []).map(markConfig),
	];
	const displays = [...displaysRegistry.getInternalDisplays(), ...(customExtensions.displays ?? []).map(markConfig)];
	const layouts = [...layoutsRegistry.getInternalLayouts(), ...(customExtensions.layouts ?? []).map(markConfig)];
	const modules = [...getInternalModules(), ...(customExtensions.modules ?? []).map(markConfig)];
	const panels = [...panelsRegistry.getInternalPanels(), ...(customExtensions.panels ?? []).map(markConfig)];
	const operations = [
		...operationsRegistry.getInternalOperations(),
		...(customExtensions.operations ?? []).map(markConfig),
	];

	interfacesRegistry.registerInterfaces(interfaces);
	displaysRegistry.registerDisplays(displays);
	layoutsRegistry.registerLayouts(layouts);
	panelsRegistry.registerPanels(panels);
	operationsRegistry.registerOperations(operations);
	setModules(modules);

	// Directus registers each config as a global component (interfaces/index.ts, displays/index.ts... of directus/app):
	// extensions render them by name (e.g. `interface-input-code`), so they are registered too, with the same checks:
	// components and layout slots as they are (functional ones included, e.g. display-raw, layout-sidebar-tabular),
	// options and operation overviews only when they are a component (not a function, an array or null).
	if (app) {
		const add = (name: string, component: unknown) => {
			if (component != null && !app.component(name)) app.component(name, component as Component);
		};
		const addOptions = (name: string, options: unknown) => {
			if (typeof options !== 'function' && !Array.isArray(options)) add(name, options);
		};

		for (const { id, component, options } of interfaces) {
			add(`interface-${id}`, component);
			addOptions(`interface-options-${id}`, options);
		}
		for (const { id, component, options } of displays) {
			add(`display-${id}`, component);
			addOptions(`display-options-${id}`, options);
		}
		for (const { id, component, slots } of layoutsRegistry.getLayouts()) {
			add(`layout-${id}`, component);
			add(`layout-options-${id}`, slots.options);
			add(`layout-sidebar-${id}`, slots.sidebar);
			add(`layout-actions-${id}`, slots.actions);
		}
		for (const { id, component, options } of panels) {
			add(`panel-${id}`, component);
			addOptions(`panel-options-${id}`, options);
		}
		for (const { id, overview, options } of operations) {
			addOptions(`operation-overview-${id}`, overview);
			addOptions(`operation-options-${id}`, options);
		}
	}

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

/**
 * The DOM an app extension renders sits in `<div data-bo-extension style="display: contents">` (no box of its own):
 * there the Tailwind `hidden` utility of the app does not hide an extension's own `.hidden` class (styles/base.css),
 * as in the Directus app, which has no such global class. Component objects only: a function may be a lazy route or a
 * functional display.
 */
function marked<T>(component: T): T {
	// Not an array either: the `options` of an interface or operation can be a list of fields.
	if (!component || typeof component !== 'object' || Array.isArray(component)) return component;

	return defineComponent({
		name: 'BoExtension',
		inheritAttrs: false,
		setup(_props, { attrs, slots }) {
			return () =>
				h('div', { 'data-bo-extension': '', style: 'display: contents' }, [h(component as Component, attrs, slots)]);
		},
	}) as T;
}

type Parts = { component?: unknown; options?: unknown; slots?: Record<string, unknown>; routes?: unknown[] };

/** An extension config with its components marked (routes of a module included, nested children too). */
function markConfig<T>(config: T): T {
	const parts = config as Parts;
	const route = (r: { component?: unknown; children?: unknown[] }): unknown => ({
		...r,
		component: marked(r.component),
		...(r.children ? { children: r.children.map((c) => route(c as typeof r)) } : {}),
	});

	return {
		...parts,
		...('component' in parts ? { component: marked(parts.component) } : {}),
		...('options' in parts ? { options: marked(parts.options) } : {}),
		...(parts.slots
			? { slots: Object.fromEntries(Object.entries(parts.slots).map(([key, slot]) => [key, marked(slot)])) }
			: {}),
		...(parts.routes ? { routes: parts.routes.map((r) => route(r as { component?: unknown })) } : {}),
	} as T;
}

let ready: Promise<void> = Promise.resolve();

/**
 * Loads the app extensions of the API, then the global components, directives and injects they expect (only when the
 * bundle has app extensions), then the registries, in the background: public pages (login) do not wait for them (012
 * SC-008). `hydrate()` awaits `extensionsReady()` before the modules register, and extensions render only after it.
 */
export function startExtensions(app: App): void {
	ready = (async () => {
		await loadExtensions();

		if (hasAppExtensions()) {
			const [{ registerShims }, { useSystem }] = await Promise.all([
				import('./directus-shim/register.ts'),
				import('./directus-shim/use-system.ts'),
			]);

			registerShims(app);
			useSystem(app);
		}

		await registerExtensions(app);
	})().catch((error: unknown) => {
		// eslint-disable-next-line no-console
		console.warn(error);
	});
}

export function extensionsReady(): Promise<void> {
	return ready;
}

export function useExtensions(): RefRecord<AppExtensionConfigs> {
	return extensions;
}
