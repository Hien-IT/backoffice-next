// Ported from directus/packages/types/src/extensions/operations.ts and api-extension-context.ts
// Backoffice: API side only (no app config, no extension system); `services` is the service index of the API
// instead of Directus' ExtensionsServices type.
import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { Accountability } from './accountability.js';
import type { Flow } from './flows.js';
import type { SchemaOverview } from './schema.js';

export type ApiExtensionContext = {
	services: Record<string, any>;
	database: Knex;
	env: Record<string, any>;
	logger: Logger;
	getSchema: (options?: { database?: Knex; bypassCache?: boolean }, attempt?: number) => Promise<SchemaOverview>;
};

export type OperationContext = ApiExtensionContext & {
	data: Record<string, unknown>;
	accountability: Accountability | null;
	flow?: Flow;
};

export type OperationHandler<Options = Record<string, unknown>> = (
	options: Options,
	context: OperationContext,
) => unknown | Promise<unknown> | void;

export interface OperationApiConfig<Options = Record<string, unknown>> {
	id: string;
	handler: OperationHandler<Options>;
}
