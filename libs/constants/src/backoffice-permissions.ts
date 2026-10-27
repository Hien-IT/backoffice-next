// Backoffice (spec 025, FR-003): the permission actions of the table backoffice_permissions, next to the five DR
// actions of PERMISSION_ACTIONS (unchanged). A later action is one more key here, no DDL (`action` is a string).

export const BACKOFFICE_EXPORT_FORMATS = ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] as const;

export const BACKOFFICE_IMPORT_FORMATS = ['csv', 'json'] as const;

export type BackofficePermissionsAction = 'import' | 'export';

export interface BackofficePermissionsActionDefinition {
	/** The DR actions the caller also needs (checked by the services as today). */
	readonly requires: readonly ('create' | 'read' | 'update')[];
	/** The formats the action supports; `options.formats` of a row is a subset (none = all). */
	readonly formats: readonly string[];
}

export const BACKOFFICE_PERMISSION_ACTIONS: Readonly<
	Record<BackofficePermissionsAction, BackofficePermissionsActionDefinition>
> = {
	/** POST /utils/import/<collection>; user collections only (DR: system collections are admin-only). */
	import: { requires: ['create', 'update'], formats: BACKOFFICE_IMPORT_FORMATS },
	/** `export` of any route that returns items, SEARCH body queries, POST /utils/export/<collection>. */
	export: { requires: ['read'], formats: BACKOFFICE_EXPORT_FORMATS },
};

/** The import format of an upload's mime type (the types ImportService accepts), or undefined. */
export function importFormatOfMimeType(mimetype: string): 'csv' | 'json' | undefined {
	if (mimetype === 'application/json') return 'json';
	if (mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel') return 'csv';
	return undefined;
}
