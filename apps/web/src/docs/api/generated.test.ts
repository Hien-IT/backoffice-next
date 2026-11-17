// Spec 033 T052 (FR-021..FR-027, FR-052; US5): the shape of the committed API files the documentation area reads.
import { describe, expect, test } from 'vitest';
import type { DocsApiResource } from '../types.ts';
import index from './generated/index.json';

const files = import.meta.glob<DocsApiResource>('./generated/*.json', { eager: true, import: 'default' });
const resources = Object.entries(files)
	.filter(([path]) => !path.endsWith('/index.json'))
	.map(([, resource]) => resource);

/** Every `#/schemas/X` of a value. */
function refs(value: unknown, found: string[] = []): string[] {
	if (Array.isArray(value)) value.forEach((item) => refs(item, found));
	else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			if (key === '$ref' && typeof item === 'string') found.push(item);
			else refs(item, found);
		}
	}
	return found;
}

describe('generated API files', () => {
	test('the index lists every resource file once, the Backoffice routes last', () => {
		expect(index.resources.map((resource) => resource.id).sort()).toEqual(
			resources.map((resource) => resource.id).sort(),
		);
		expect(index.resources.at(-1)).toMatchObject({ id: 'backoffice', backofficeOnly: true });
		expect(index.resources.filter((resource) => resource.backofficeOnly)).toHaveLength(1);
	});

	test.each(resources.map((resource) => [resource.id, resource] as const))('%s', (_id, resource) => {
		expect(resource.operations.length).toBeGreaterThan(0);
		expect(['en', 'vi']).toContain(resource.lang);

		const anchors = resource.operations.map((operation) => operation.anchor);
		expect(new Set(anchors).size).toBe(anchors.length);

		for (const operation of resource.operations) {
			expect(operation.anchor).toMatch(/^[a-z0-9-]+$/);
			expect(operation.rest).toMatch(/^curl /);
			expect(operation.graphql === false || operation.graphql.startsWith('# POST /graphql')).toBe(true);
			if (operation.backofficeOnly) expect(operation.access).toBeDefined();
		}

		// Response and body schemas point at schemas of the same file (the nested ones may be absent: shown by name).
		const used = refs(resource.operations.map((operation) => [operation.body, operation.responses]));
		for (const ref of used) expect(ref).toMatch(/^#\/schemas\/./);
		for (const ref of new Set(used)) expect(resource.schemas, ref).toHaveProperty(ref.slice('#/schemas/'.length));
	});
});
