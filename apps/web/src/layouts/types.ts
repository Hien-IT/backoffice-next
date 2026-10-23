// Ported from directus/packages/extensions/src/shared/utils/define-extension.ts
// Backoffice: the layout types of @directus/types and `defineLayout` (an identity helper, as DR); the five internal
// layouts only, no layout extensions (D-41, spec 014 FR-020).
import type { LayoutConfig, LayoutProps, ShowSelect } from '@directus/types';

export type { LayoutConfig, LayoutProps, ShowSelect };

/** Second argument of a layout `setup` (`LayoutContext` is not exported by @directus/types). */
export type LayoutContext = Parameters<LayoutConfig['setup']>[1];

export function defineLayout<Options = any, Query = any>(
	config: LayoutConfig<Options, Query>,
): LayoutConfig<Options, Query> {
	return config;
}
