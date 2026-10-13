// Backoffice: Directus registers the built-in operations by reading directus/api/src/operations at startup
// (extensions/manager.ts registerInternalOperations). There is no extension manager here (Principle XI), so the
// FlowManager registers this static list instead, in the order of the Directus folders (feature 009, research R2).
import type { OperationApiConfig } from '@backoffice/types';
import condition from './condition/index.js';
import log from './log/index.js';
import sleep from './sleep/index.js';
import throwError from './throw-error/index.js';
import transform from './transform/index.js';

export const operations: OperationApiConfig<any>[] = [condition, log, sleep, throwError, transform];
