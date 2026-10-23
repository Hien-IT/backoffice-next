import type { DisplayConfig as DirectusDisplayConfig } from '@directus/types';

// Config of a display (`<id>/index.ts`), as in DR. `options` keeps every DR form for 016 (D-56).
export type DisplayConfig = DirectusDisplayConfig;

export type DisplayOptions = DisplayConfig['options'];

/** Identity helper, like `defineDisplay` of @directus/extensions-sdk. */
export function defineDisplay(config: DisplayConfig): DisplayConfig {
	return config;
}

/** Props every display receives from `RenderDisplay` (contracts/registry.md §2), besides `display_options`. */
export interface DisplayProps {
	value?: unknown;
	interface?: string;
	interfaceOptions?: Record<string, unknown>;
	type?: string;
	collection?: string;
	field?: string;
}
