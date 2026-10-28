// Backoffice (spec 025, FR-008, D-189.1): refuse an import or export the caller's policies do not allow, with the
// collection permission error of 024 (no hint whether the collection exists or which rule refused).
import type { BackofficePermissionsAction } from '@backoffice/constants';
import type { Accountability, Query } from '@backoffice/types';
import type { Context } from '../../types.js';
import { fetchAllowedFields } from '../fetch-allowed-fields/fetch-allowed-fields.js';
import { createCollectionForbiddenError } from '../process-ast/utils/validate-path/create-error.js';
import { applyExportAccess } from './apply-export-access.js';
import { type BackofficeAccess, fetchBackofficeAccess, forFormat, isUnrestricted } from './fetch-backoffice-access.js';

export interface AssertBackofficeActionOptions {
	/** null: an internal call without accountability, never checked (as DR services). */
	accountability: Accountability | null | undefined;
	collection: string;
	action: BackofficePermissionsAction;
	/** The requested format; undefined skips the format check. */
	format?: string | undefined;
}

const UNCHECKED: BackofficeAccess = {
	allowed: true,
	filter: null,
	fields: ['*'],
	formats: [],
	rules: [{ filter: null, fields: ['*'], formats: [] }],
};

export async function assertBackofficeAction(
	{ accountability, collection, action, format }: AssertBackofficeActionOptions,
	context: Context,
): Promise<BackofficeAccess> {
	if (!accountability) return UNCHECKED;

	const all = await fetchBackofficeAccess({ accountability, collection, action }, context);
	// The rules of the requested format only (FR-011, FR-017).
	const access = format === undefined ? all : forFormat(all, format);

	if (!access.allowed) throw createCollectionForbiddenError('', collection);

	return access;
}

export interface AssertExportOptions extends Omit<AssertBackofficeActionOptions, 'action'> {
	query: Query;
}

/** An export (FR-006, FR-015): check the action and format; the query with the Use custom rules put in (a new object). */
export async function assertExport({ query, ...options }: AssertExportOptions, context: Context): Promise<Query> {
	const access = await assertBackofficeAction({ ...options, action: 'export' }, context);

	if (!options.accountability || isUnrestricted(access)) return query;

	const readable = access.fields.includes('*')
		? ['*']
		: await fetchAllowedFields(
				{ accountability: options.accountability, action: 'read', collection: options.collection },
				context,
			);

	return applyExportAccess(query, access, options.collection, readable);
}
