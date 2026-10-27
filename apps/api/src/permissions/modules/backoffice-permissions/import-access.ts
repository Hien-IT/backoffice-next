// Backoffice (spec 025, FR-007, FR-016, D-189.1): the import permission of /utils/import. System collections keep the
// DR rule (ImportService refuses non-admins), so they are not checked here and answer as DR. Create and update are
// checked first, as ImportService does, so a caller without them gets the same error as from DR (research T002).
import { importFormatOfMimeType } from '@backoffice/constants';
import { isSystemCollection } from '@backoffice/system-data';
import type { Accountability } from '@backoffice/types';
import { validatePayload } from '@backoffice/utils';
import type { RowGuard } from '../../../services/import-export.service.js';
import type { Context } from '../../types.js';
import { createCollectionForbiddenError } from '../process-ast/utils/validate-path/create-error.js';
import { validateAccess } from '../validate-access/validate-access.js';
import { assertBackofficeAction } from './assert-backoffice-action.js';
import type { BackofficeAccess } from './fetch-backoffice-access.js';

/** The import access of the caller on a user collection, or null when nothing is checked (admin, system, internal). */
export async function assertImport(
	accountability: Accountability | null | undefined,
	collection: string,
	context: Context,
): Promise<BackofficeAccess | null> {
	if (!accountability || accountability.admin || isSystemCollection(collection)) return null;

	for (const action of ['create', 'update'] as const) {
		await validateAccess({ accountability, action, collection }, context);
	}

	return assertBackofficeAction({ accountability, collection, action: 'import' }, context);
}

/**
 * The format of the uploaded file must be allowed; the row filter and the allowed columns become a check of each row,
 * and one row outside them refuses the whole file (clarify 2026-10-28, question 1).
 */
export function importRowGuard(access: BackofficeAccess, collection: string, mimetype: string): RowGuard | undefined {
	const format = importFormatOfMimeType(mimetype);

	// An unsupported type is left to ImportService, which answers it as DR does.
	if (format && !access.formats.includes(format)) throw createCollectionForbiddenError('', collection);

	const allFields = access.fields.includes('*');
	if (!access.filter && allFields) return undefined;

	return (row) => {
		const outside = !allFields && Object.keys(row).some((field) => !access.fields.includes(field));

		if (outside || (access.filter && validatePayload(access.filter, row).length > 0)) {
			throw createCollectionForbiddenError('', collection);
		}
	};
}
