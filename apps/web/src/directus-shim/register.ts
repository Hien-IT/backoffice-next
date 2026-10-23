// Ported from directus/app/src/components/register.ts; Ported from directus/app/src/views/register.ts
// Backoffice (spec 020, FR-073..FR-082, data-model §7): the global components, views and directives the DR app
// registers, so app extensions built for DR 11.17.4 render inside the new app. Each name maps to a shim under
// ./components or ./views (on Bo* and the design-system) or to the port that already has the same contract. Imported
// only when the extension bundle holds app extensions (main.ts), so the main bundle does not grow.
import type { App, Component } from 'vue';
import DrawerBatch from '../components/drawers/DrawerBatch.vue';
import DrawerFiles from '../components/drawers/DrawerFiles.vue';
import FieldList from '../components/FieldList.vue';
import BoDatePicker from '../components/BoDatePicker.vue';
import ErrorBoundary from '../components/render/ErrorBoundary.vue';
import RenderDisplay from '../components/render/RenderDisplay.vue';
import RenderTemplate from '../components/render/RenderTemplate.vue';
import UserPopover from '../components/render/UserPopover.vue';
import ValueNull from '../components/render/ValueNull.vue';
import ExportSidebarDetail from '../components/sidebar/ExportSidebarDetail.vue';
import SidebarDetail from '../components/sidebar/SidebarDetail.vue';
import { registerDirectives } from './directives/index.ts';
import './styles/theme-vars.css';

const shims = import.meta.glob<Component>('./components/*.vue', { import: 'default', eager: true });
const views = import.meta.glob<Component>('./views/*.vue', { import: 'default', eager: true });

const byFileName = (modules: Record<string, Component>) =>
	Object.fromEntries(
		Object.entries(modules).map(([path, component]) => [path.split('/').pop()!.slice(0, -4), component]),
	);

/** DR name → component: the shims (file name = registered name) and the ports with the same contract. */
export const SHIM_COMPONENTS: Record<string, Component> = {
	DrawerBatch,
	DrawerFiles,
	ExportSidebarDetail,
	RenderDisplay,
	RenderTemplate,
	SidebarDetail,
	UserPopover,
	ValueNull,
	VDatePicker: BoDatePicker,
	VErrorBoundary: ErrorBoundary,
	VFieldList: FieldList,
	...byFileName(shims),
};

export const SHIM_VIEWS: Record<string, Component> = byFileName(views);

export function registerShims(app: App): void {
	for (const [name, component] of Object.entries({ ...SHIM_COMPONENTS, ...SHIM_VIEWS })) app.component(name, component);
	registerDirectives(app);
}
