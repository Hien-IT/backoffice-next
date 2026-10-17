import type { PanelConfig as DirectusPanelConfig, PanelQuery } from '@directus/types';

/**
 * PanelConfig of @directus/types with `any` for the options a panel reads: the ported definitions read them with dot
 * access (`options.collection`), which noPropertyAccessFromIndexSignature refuses on Record<string, any>.
 */
export type PanelConfig = Omit<DirectusPanelConfig, 'query' | 'options'> & {
	query?: (options: any) => PanelQuery | PanelQuery[] | undefined;
	options: Exclude<DirectusPanelConfig['options'], (...args: any[]) => any> | ((ctx: any) => any);
};

export type { PanelQuery };

/** Identity helper, like `definePanel` of @directus/extensions (spec 018 FR-031). */
export function definePanel(config: PanelConfig): PanelConfig {
	return config;
}
