// Ported from directus/app/src/modules/settings/routes/extensions/constants.ts; Ported from directus/app/src/constants/extension-type-icon-map.ts
import type { ExtensionType } from './types.ts';

export const extensionTypeIconMap: Record<ExtensionType, string> = {
	interface: 'design_services',
	display: 'label',
	layout: 'dataset',
	module: 'web',
	panel: 'analytics',
	theme: 'palette',
	hook: 'webhook',
	endpoint: 'api',
	operation: 'flowsheet',
	bundle: 'hub',
	missing: 'warning',
};
