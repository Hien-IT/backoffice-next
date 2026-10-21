// Ported from directus/packages/extensions/src/shared/utils/define-extension.ts
// Backoffice: API side helpers only; the app helpers (defineInterface, defineDisplay...) live in the web app's
// `@directus/extensions-sdk` shared module (feature 020, contracts/web.md §3).
import type { EndpointConfig, HookConfig, OperationApiConfig } from '../types/index.js';

export function defineHook(config: HookConfig): HookConfig {
	return config;
}

export function defineEndpoint(config: EndpointConfig): EndpointConfig {
	return config;
}

export function defineOperationApi<Options = Record<string, unknown>>(
	config: OperationApiConfig<Options>,
): OperationApiConfig<Options> {
	return config;
}
