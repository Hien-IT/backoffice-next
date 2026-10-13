// Ported from directus/packages/extensions/src/shared/utils/define-extension.ts (defineOperationApi only)
import type { OperationApiConfig } from '@backoffice/types';

export function defineOperationApi<Options = Record<string, unknown>>(
	config: OperationApiConfig<Options>,
): OperationApiConfig<Options> {
	return config;
}
