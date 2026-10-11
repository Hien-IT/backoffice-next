// Ported from directus/api/src/permissions/modules/process-ast/utils/validate-path/create-error.ts
import { type BackofficeError, ForbiddenError } from '@backoffice/errors';

export function createCollectionForbiddenError(path: string, collection: string): BackofficeError<any> {
	const pathSuffix = path === '' ? 'root' : `"${path}"`;

	return new ForbiddenError({
		reason: `You don't have permission to access collection "${collection}" or it does not exist. Queried in ${pathSuffix}.`,
	});
}

export function createFieldsForbiddenError(path: string, collection: string, fields: string[]): BackofficeError<any> {
	const pathSuffix = path === '' ? 'root' : `"${path}"`;

	const fieldStr = fields.map((field) => `"${field}"`).join(', ');

	return new ForbiddenError({
		reason:
			fields.length === 1
				? `You don't have permission to access field ${fieldStr} in collection "${collection}" or it does not exist. Queried in ${pathSuffix}.`
				: `You don't have permission to access fields ${fieldStr} in collection "${collection}" or they do not exist. Queried in ${pathSuffix}.`,
	});
}
