// Spec 033 (FR-026, FR-055, research R7; contracts/tests.md §4): every GraphQL example of the documentation area is a
// valid document for the schema of the running Backoffice API. Not a comparison with Directus: the examples are
// documentation content, checked against the real schema so a wrong field or argument cannot ship. The examples name
// a user collection `articles` (title, author); the test creates it for the items scope and drops it after.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSchema, type GraphQLSchema, parse, validate } from 'graphql';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { appRequest, appUrl, adminToken } from '../directus-api.js';

const GENERATED = join(import.meta.dirname, '../../../../apps/web/src/docs/api/generated');

interface Example {
	resource: string;
	operation: string;
	scope: 'system' | 'items';
	document: string;
}

/** Every example, with its scope read from the first line (`# POST /graphql/system` or `# POST /graphql`). */
export function examples(dir = GENERATED): Example[] {
	return readdirSync(dir)
		.filter((file) => file.endsWith('.json') && file !== 'index.json')
		.sort()
		.flatMap((file) => {
			const resource = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
				id: string;
				operations: { id: string; graphql: string | false }[];
			};

			return resource.operations
				.filter((operation) => operation.graphql !== false)
				.map((operation) => {
					const document = operation.graphql as string;
					const first = document.split('\n')[0] ?? '';
					if (!/^# POST \/graphql(\/system)?$/.test(first)) {
						throw new Error(`${resource.id}/${operation.id}: the first line must name the endpoint`);
					}
					return {
						resource: resource.id,
						operation: operation.id,
						scope: first.endsWith('/system') ? ('system' as const) : ('items' as const),
						document,
					};
				});
		});
}

const COLLECTION = 'articles';
let created = false;
const schemas: Partial<Record<'system' | 'items', GraphQLSchema>> = {};

async function sdl(scope: 'system' | 'items'): Promise<string> {
	const res = await fetch(new URL(`/server/specs/graphql/${scope === 'system' ? 'system' : ''}`, appUrl('backoffice')), {
		headers: { authorization: `Bearer ${await adminToken('backoffice')}`, 'cache-control': 'no-store' },
	});
	if (!res.ok) throw new Error(`SDL of ${scope}: ${res.status}`);
	return res.text();
}

beforeAll(async () => {
	const existing = await appRequest('backoffice', 'GET', '/collections').then((body) =>
		(body.data as { collection: string }[]).some((row) => row.collection === COLLECTION),
	);

	if (!existing) {
		await appRequest('backoffice', 'POST', '/collections', {
			collection: COLLECTION,
			schema: {},
			meta: {},
			fields: [
				{ field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true } },
				{ field: 'title', type: 'string', schema: {}, meta: {} },
			],
		});
		created = true;
	}

	schemas.system = buildSchema(await sdl('system'));
	schemas.items = buildSchema(await sdl('items'));
}, 120_000);

afterAll(async () => {
	if (created) await appRequest('backoffice', 'DELETE', `/collections/${COLLECTION}`);
});

test('the documentation has GraphQL examples for both scopes', () => {
	const all = examples();

	expect(all.filter((example) => example.scope === 'system').length).toBeGreaterThan(80);
	expect(all.filter((example) => example.scope === 'items').length).toBe(7);
});

test('every GraphQL example of the documentation is valid for the schema of the API', () => {
	const errors = examples().flatMap((example) =>
		validate(schemas[example.scope]!, parse(example.document)).map(
			(error) => `${example.resource}/${example.operation}: ${error.message}`,
		),
	);

	expect(errors).toEqual([]);
});
