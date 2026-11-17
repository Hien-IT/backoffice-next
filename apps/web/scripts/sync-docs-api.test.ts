// Spec 033 T051 (FR-021, FR-022, FR-026, FR-027, FR-029, FR-052; research R7): the API part of the documentation is
// what the script writes from the static description and the supplement, covers every operation but the excluded ones
// and every /backoffice/* route the API serves.
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	buildResources,
	EXCLUDED,
	GRAPHQL,
	HOST,
	loadEnglish,
	loadSpec,
	loadSupplements,
	OUT_DIR,
	renderFiles,
	writeFiles,
} from './sync-docs-api.mjs';

const spec = loadSpec();
const supplements = loadSupplements();
const { resources, excluded } = buildResources(spec, supplements);
const operations = resources.flatMap((resource) => resource.operations);

const METHODS = ['get', 'post', 'patch', 'put', 'delete', 'head', 'search'];
const CONTROLLERS = join(import.meta.dirname, '../../api/src/controllers');

/** `METHOD /path` of every route the five Backoffice-only controllers declare (`:x` written `{}`). */
function backofficeRoutes(): string[] {
	return readdirSync(CONTROLLERS)
		.filter((file) => /^backoffice-.*\.controller\.ts$/.test(file))
		.flatMap((file) => {
			const source = readFileSync(join(CONTROLLERS, file), 'utf8');
			const prefix = /@Controller\('([^']*)'\)/.exec(source)![1]!;

			return [...source.matchAll(/@(Get|Post|Patch|Delete)\(([^)]*)\)/g)].map(([, method, raw]) => {
				const sub = raw!.replace(/['"`]/g, '');
				const path = `/${[prefix, sub].filter(Boolean).join('/')}`.replace(/:[A-Za-z]+/g, '{}');
				return `${method!.toUpperCase()} ${path}`;
			});
		})
		.sort();
}

const shape = (method: string, path: string) => `${method} ${path.replace(/\{[^}]+\}/g, '{}')}`;

describe('sync-docs-api', () => {
	test('the committed files are what the script writes now', () => {
		const dir = mkdtempSync(join(tmpdir(), 'docs-api-'));
		writeFiles(renderFiles(spec, supplements), dir);

		const names = (readdirSync(dir, { recursive: true }) as string[]).filter((name) => name.endsWith('.json')).sort();
		expect(
			(readdirSync(OUT_DIR, { recursive: true }) as string[]).filter((name) => name.endsWith('.json')).sort(),
		).toEqual(names);
		for (const name of names)
			expect(readFileSync(join(OUT_DIR, name), 'utf8'), name).toBe(readFileSync(join(dir, name), 'utf8'));
	});

	test('every operation of the static description has an entry, but the excluded ones (each with a reason)', () => {
		const ids = Object.values(spec.paths as Record<string, Record<string, { operationId?: string }>>).flatMap((item) =>
			METHODS.map((method) => item[method]?.operationId).filter((id): id is string => !!id),
		);
		const documented = new Set(operations.map((operation) => operation.id));

		expect(ids.filter((id) => !documented.has(id)).sort()).toEqual(Object.keys(EXCLUDED).sort());
		expect(excluded).toEqual(Object.keys(EXCLUDED).sort());
		for (const reason of Object.values(EXCLUDED)) expect(reason.length).toBeGreaterThan(20);
	});

	test('every /backoffice/* route the API declares has an entry, only Backoffice, with who may call it', () => {
		const documented = operations
			.filter((operation) => operation.path.startsWith('/backoffice/'))
			.map((operation) => shape(operation.method, operation.path))
			.sort();

		expect(documented).toEqual(backofficeRoutes());

		for (const operation of operations.filter((o) => o.path.startsWith('/backoffice/'))) {
			expect(operation.backofficeOnly, operation.id).toBe(true);
			expect(['admin', 'authenticated', 'public'], operation.id).toContain(operation.access);
		}
	});

	test('the seven resources the static description lacks have a page (FR-022)', () => {
		const ids = resources.map((resource) => resource.id);

		for (const id of ['policies', 'access', 'dashboards', 'panels', 'notifications', 'translations', 'shares']) {
			expect(ids).toContain(id);
		}
	});

	test('REST examples use the placeholder host and token; public routes send no token (FR-029)', () => {
		for (const operation of operations) {
			expect(operation.rest, operation.id).toContain(`"${HOST}/`);
			expect(operation.rest, operation.id).not.toMatch(/Bearer (?!<token>)/);
			if (operation.access === 'public') expect(operation.rest, operation.id).not.toContain('Authorization');
		}
	});

	test('GraphQL: every operation has an example or false; the hand-written table names real operations', () => {
		const ids = new Set(operations.map((operation) => operation.id));

		for (const operation of operations) {
			expect(operation.graphql === false || typeof operation.graphql === 'string', operation.id).toBe(true);
			if (operation.graphql) expect(operation.graphql, operation.id).toMatch(/^# POST \/graphql(\/system)?\n/);
		}
		for (const id of Object.keys(GRAPHQL)) expect(ids.has(id) || id in EXCLUDED, id).toBe(true);
		expect(operations.filter((operation) => operation.path.startsWith('/backoffice/') && operation.graphql)).toEqual(
			[],
		);
	});

	test('no standalone brand word in the output (FR-047)', () => {
		const text = Object.values(renderFiles(spec, supplements)).join('\n');

		expect(text).not.toMatch(/(?<![A-Za-z])Directus(?![A-Za-z])/);
	});

	// Amendment 2026-11-18: the English output has every resource and operation, in English, with English anchors.
	test('English: the same resources and operations, no Vietnamese text left; a text missing from en.json fails', () => {
		const english = buildResources(spec, supplements, { lang: 'en', english: loadEnglish() });

		expect(english.missing).toEqual([]);
		expect(english.resources.map((r) => [r.id, r.operations.map((o) => o.id)])).toEqual(
			resources.map((r) => [r.id, r.operations.map((o) => o.id)]),
		);
		const text = JSON.stringify(english.resources);
		expect(text).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
		expect(english.resources.flatMap((r) => r.operations).every((o) => o.lang === 'en')).toBe(true);
		expect(english.resources.find((r) => r.id === 'dashboards')!.operations[0]!.anchor).toBe('list-dashboards');

		expect(() => renderFiles(spec, supplements, {})).toThrow(/have no English in supplement\/en\.json/);
	});

	test('a supplement may not define a tag or a schema twice', () => {
		const twice = [...supplements, supplements.find((s) => s.file === 'policies.yaml')!];
		expect(() => buildResources(spec, twice)).toThrow(/defines the tag Policies again/);
	});
});
