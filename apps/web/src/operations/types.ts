import type { OperationAppConfig } from '@directus/types';

export type { OperationAppConfig };

/** One option field of an operation (the element type of `options`). */
export type OperationField = Extract<NonNullable<OperationAppConfig['options']>, unknown[]>[number];

/** Identity helper, like `defineOperationApp` of @directus/extensions (spec 017 FR-041). */
export function defineOperationApp(config: OperationAppConfig): OperationAppConfig {
	return config;
}
