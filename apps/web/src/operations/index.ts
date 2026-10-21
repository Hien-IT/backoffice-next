// Ported from directus/app/src/operations/index.ts
import { sortBy } from 'lodash-es';
import type { OperationAppConfig } from './types.ts';

// Backoffice: the 15 built-in operations and those of app extensions (spec 020); configs are looked up by id instead of
// being registered as global components (none of them has a component overview or options).
const internal = sortBy(
	Object.values(import.meta.glob<OperationAppConfig>('./*/index.ts', { import: 'default', eager: true })),
	'id',
);

let operations = internal;

export function getInternalOperations(): OperationAppConfig[] {
	return [...internal];
}

/** Spec 020 (FR-064): the internal operations and those of app extensions. */
export function registerOperations(list: OperationAppConfig[]): void {
	operations = sortBy(list, 'id');
}

export function getOperations(): OperationAppConfig[] {
	return operations;
}

export function getOperation(id: string | null | undefined): OperationAppConfig | undefined {
	return operations.find((operation) => operation.id === id);
}
