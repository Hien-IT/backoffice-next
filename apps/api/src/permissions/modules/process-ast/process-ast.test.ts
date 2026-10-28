// Ported from directus/api/src/permissions/modules/process-ast/process-ast.test.ts
import { ForbiddenError } from '@backoffice/errors';
import { SchemaBuilder } from '@backoffice/schema-builder';
import type { Accountability } from '@backoffice/types';
import { beforeEach, expect, test, vi } from 'vitest';
import type { AST } from '../../../types/ast.js';
import { fetchPermissions } from '../../lib/fetch-permissions.js';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import type { Context } from '../../types.js';
import { processAst } from './process-ast.js';

vi.mock('../../lib/fetch-policies.js');
vi.mock('../../lib/fetch-permissions.js');

vi.mock('../../../services/permissions.service.js', () => ({
	PermissionsService: vi.fn(),
}));

vi.mock('../../../services/access.service.js', () => ({
	AccessService: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();

	vi.mocked(fetchPolicies).mockResolvedValue([]);
	vi.mocked(fetchPermissions).mockResolvedValue([]);
});

test('Returns AST unmodified if accountability is null', async () => {
	const schema = new SchemaBuilder()
		.collection('test-collection', (c) => {
			c.field('id').id();
		})
		.build();

	const ast = { type: 'root', name: 'test-collection', children: [] } as unknown as AST;
	const accountability = null;

	const output = await processAst({ action: 'read', accountability, ast }, { schema } as Context);

	expect(output).toBe(ast);
});

test('Returns AST unmodified and unverified is current user is admin', async () => {
	const schema = new SchemaBuilder()
		.collection('test-collection', (c) => {
			c.field('id').id();
		})
		.build();

	const ast = { type: 'root', name: 'test-collection', children: [] } as unknown as AST;
	const accountability = { user: null, roles: [], admin: true } as unknown as Accountability;

	const output = await processAst({ accountability, action: 'read', ast }, { schema } as Context);

	expect(output).toBe(ast);
});

test('Validates all paths existence in AST if accountability is null', async () => {
	const ast = { type: 'root', name: 'test-collection', children: [] } as unknown as AST;
	const schema = new SchemaBuilder().build();
	const accountability = null;

	await expect(async () =>
		processAst({ action: 'read', accountability, ast }, { schema } as Context),
	).rejects.toThrowError(ForbiddenError);
});

test('Validates all paths existence in AST if current user is admin', async () => {
	const ast = { type: 'root', name: 'test-collection', children: [] } as unknown as AST;
	const schema = new SchemaBuilder().build();
	const accountability = { admin: true } as unknown as Accountability;

	await expect(async () =>
		processAst({ action: 'read', accountability, ast }, { schema } as Context),
	).rejects.toThrowError(ForbiddenError);
});

test('Validates all paths in AST and throws if no permissions match', async () => {
	const schema = new SchemaBuilder()
		.collection('test-collection', (c) => {
			c.field('id').id();
		})
		.build();

	const ast = { type: 'root', name: 'test-collection', children: [] } as unknown as AST;
	const accountability = { user: null, roles: [] } as unknown as Accountability;

	vi.mocked(fetchPolicies).mockResolvedValue(['test-policy-1']);

	await expect(
		async () => await processAst({ action: 'read', ast, accountability }, { schema } as Context),
	).rejects.toThrowError(ForbiddenError);

	expect(fetchPermissions).toHaveBeenCalledWith(
		{
			accountability,
			action: 'read',
			policies: ['test-policy-1'],
			collections: ['test-collection'],
		},
		{
			schema,
		},
	);
});

test('Injects permission cases for the provided AST', async () => {
	const ast = {
		type: 'root',
		name: 'test-collection',
		children: [
			{
				type: 'field',
				fieldKey: 'test-field-a',
				name: 'test-field-a',
			},
		],
	} as unknown as AST;

	const schema = new SchemaBuilder()
		.collection('test-collection', (c) => {
			c.field('test-field-a').id();
		})
		.build();

	const accountability = { user: null, roles: [] } as unknown as Accountability;

	vi.mocked(fetchPolicies).mockResolvedValue(['test-policy-1']);

	vi.mocked(fetchPermissions).mockResolvedValue([
		{
			policy: 'test-policy-1',
			collection: 'test-collection',
			action: 'read',
			fields: ['*'],
			permissions: { status: { _eq: 'published' } },
			validation: null,
			presets: null,
		},
	]);

	await processAst({ ast, action: 'read', accountability }, { schema } as Context);

	expect(ast).toEqual({
		type: 'root',
		name: 'test-collection',
		cases: [
			{
				status: {
					_eq: 'published',
				},
			},
		],
		children: [
			{
				type: 'field',
				fieldKey: 'test-field-a',
				name: 'test-field-a',
				whenCase: [0],
			},
		],
	});
});

// Backoffice (spec 025, FR-011): an export pairs the root read permissions with the export rules of the policies.
test('Pairs the root read permissions with the export rules', async () => {
	const ast = {
		type: 'root',
		name: 'test-collection',
		children: [
			{ type: 'field', fieldKey: 'test-field-a', name: 'test-field-a' },
			{ type: 'field', fieldKey: 'test-field-b', name: 'test-field-b' },
		],
	} as unknown as AST;

	const schema = new SchemaBuilder()
		.collection('test-collection', (c) => {
			c.field('test-field-a').id();
			c.field('test-field-b').string();
		})
		.build();

	const accountability = { user: 'u1', roles: [] } as unknown as Accountability;
	const published = { status: { _eq: 'published' } };
	const own = { owner: { _eq: 'u1' } };

	vi.mocked(fetchPolicies).mockResolvedValue(['test-policy-1']);

	vi.mocked(fetchPermissions).mockResolvedValue([
		{
			policy: 'test-policy-1',
			collection: 'test-collection',
			action: 'read',
			fields: ['*'],
			permissions: published,
			validation: null,
			presets: null,
		},
	]);

	await processAst(
		{
			ast,
			action: 'read',
			accountability,
			exportRules: [
				{ filter: own, fields: ['*'], formats: ['csv'] },
				{ filter: null, fields: ['test-field-a'], formats: ['csv'] },
			],
		},
		{ schema } as Context,
	);

	// Field a shows on published rows (second pair) or own published rows (first); field b only on the first.
	expect(ast.cases).toEqual([{ _and: [published, own] }, published]);
	expect(ast.children.map((child) => (child as { whenCase?: number[] }).whenCase)).toEqual([[0, 1], [0]]);
});
