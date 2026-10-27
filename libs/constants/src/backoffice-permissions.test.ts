import { expect, test } from 'vitest';
import {
	BACKOFFICE_EXPORT_FORMATS,
	BACKOFFICE_IMPORT_FORMATS,
	BACKOFFICE_PERMISSION_ACTIONS,
	importFormatOfMimeType,
} from './backoffice-permissions.js';
import { PERMISSION_ACTIONS } from './permissions.js';

test('two Backoffice actions with their required DR actions and formats (spec 025, FR-003)', () => {
	expect(Object.keys(BACKOFFICE_PERMISSION_ACTIONS)).toEqual(['import', 'export']);
	expect(BACKOFFICE_PERMISSION_ACTIONS.import.requires).toEqual(['create', 'update']);
	expect(BACKOFFICE_PERMISSION_ACTIONS.export.requires).toEqual(['read']);
	expect(BACKOFFICE_IMPORT_FORMATS).toEqual(['csv', 'json']);
	expect(BACKOFFICE_EXPORT_FORMATS).toEqual(['csv', 'csv_utf8', 'json', 'xml', 'yaml']);
});

test('the DR actions are unchanged', () => {
	expect(PERMISSION_ACTIONS).toEqual(['create', 'read', 'update', 'delete', 'share']);
});

test('import format of a mime type', () => {
	expect(importFormatOfMimeType('application/json')).toBe('json');
	expect(importFormatOfMimeType('text/csv')).toBe('csv');
	expect(importFormatOfMimeType('application/vnd.ms-excel')).toBe('csv');
	expect(importFormatOfMimeType('text/plain')).toBeUndefined();
});
