// Backoffice (spec 032): the registry of the table-backed sync groups (data-model.md).
import { expect, test } from 'vitest';
import { keyOf, rowId, strip, TABLE_KINDS, tableKind, WRITE_ORDER } from './groups.js';

test('every table kind has a group, a key, ignored columns and a place in the write order', () => {
	expect(TABLE_KINDS.map((k) => k.kind)).toEqual([
		'folder',
		'role',
		'policy',
		'link',
		'permission',
		'bo_permission',
		'translation',
		'preset',
		'flow',
		'dashboard',
		'index',
	]);

	for (const kind of TABLE_KINDS) {
		expect(kind.key.length).toBeGreaterThan(0);
		if (kind.kind !== 'index') expect(WRITE_ORDER).toContain(kind.kind);
	}
});

test('natural keys and the columns left out follow data-model.md (clarify 4, FR-012, FR-024)', () => {
	expect(tableKind('permission')).toMatchObject({ key: ['policy', 'collection', 'action'], ignore: ['id'] });
	expect(tableKind('bo_permission')).toMatchObject({ key: ['policy', 'collection', 'action'], ignore: ['id'] });
	expect(tableKind('translation')).toMatchObject({ key: ['language', 'key'], ignore: ['id'] });
	expect(tableKind('preset')).toMatchObject({ key: ['collection', 'bookmark'], ignore: ['id', 'user', 'role'] });
	expect(tableKind('index')).toMatchObject({ key: ['collection', 'name'] });
	expect(tableKind('link')?.filter).toEqual({ user: { _null: true } });
	expect(tableKind('flow')?.ignore).toEqual(['date_created', 'user_created']);
	expect(tableKind('flow')?.nested).toMatchObject({ name: 'operations', parent: 'flow' });
	expect(tableKind('dashboard')?.nested).toMatchObject({ name: 'panels', parent: 'dashboard' });
});

test('keyOf joins the key columns, a null column is empty; rowId prefixes group and kind', () => {
	expect(keyOf(tableKind('preset')!, { collection: 'articles', bookmark: null })).toBe('articles:');
	expect(keyOf(tableKind('permission')!, { policy: 'p1', collection: 'a', action: 'read' })).toBe('p1:a:read');
	expect(rowId('access', 'permission', 'p1:a:read')).toBe('access/permission:p1:a:read');
});

test('strip drops the ignored columns of the row and of its nested rows', () => {
	const flow = {
		id: 'f1',
		name: 'Flow',
		date_created: 'x',
		user_created: 'u',
		operations: [{ id: 'o1', key: 'log', date_created: 'x', user_created: 'u' }],
	};

	expect(strip(tableKind('flow')!, flow)).toEqual({ id: 'f1', name: 'Flow', operations: [{ id: 'o1', key: 'log' }] });
	expect(strip(tableKind('permission')!, { id: 7, policy: 'p', action: 'read' })).toEqual({
		policy: 'p',
		action: 'read',
	});
});
