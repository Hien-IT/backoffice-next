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
import { type BackofficeAccess, type BackofficeRule, forFormat, isUnrestricted } from './fetch-backoffice-access.js';

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
 * Only the rules of the uploaded file's format take part; each row must fit one of them whole (its filter and its
 * columns), as a policy allows (FR-011), and one row that fits none refuses the whole file (clarify 2026-10-28,
 * question 1).
 */
export function importRowGuard(access: BackofficeAccess, collection: string, mimetype: string): RowGuard | undefined {
	const format = importFormatOfMimeType(mimetype);
	// An unsupported type is left to ImportService, which answers it as DR does.
	const scoped = format ? forFormat(access, format) : access;

	if (!scoped.allowed) throw createCollectionForbiddenError('', collection);
	if (isUnrestricted(scoped)) return undefined;

	return (row) => {
		if (!scoped.rules.some((rule) => fits(rule, row))) throw createCollectionForbiddenError('', collection);
	};
}

function fits(rule: BackofficeRule, row: Record<string, unknown>): boolean {
	const columns = rule.fields.includes('*') || Object.keys(row).every((field) => rule.fields.includes(field));
	return columns && (!rule.filter || validatePayload(rule.filter, row).length === 0);
}
