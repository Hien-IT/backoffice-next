// Ported from directus/app/src/operations/index.ts
import { sortBy } from 'lodash-es';
import type { OperationAppConfig } from './types.ts';

// Backoffice: the 15 built-in operations only (no extensions, principle XI); configs are looked up by id instead of
// being registered as global components (none of them has a component overview or options).
const operations = sortBy(
	Object.values(import.meta.glob<OperationAppConfig>('./*/index.ts', { import: 'default', eager: true })),
	'id',
);

export function getOperations(): OperationAppConfig[] {
	return operations;
}

export function getOperation(id: string | null | undefined): OperationAppConfig | undefined {
	return operations.find((operation) => operation.id === id);
}
