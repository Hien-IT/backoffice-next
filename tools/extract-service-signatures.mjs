#!/usr/bin/env node
// Spec 020 (FR-010, D-141): the `services` context of an extension must offer the same classes as Directus. This lists
// the exports of directus/api/src/services/index.ts and of the Backoffice services handed to extensions (the service
// index plus apps/api/src/extensions/services.ts), with each class' constructor arity and public methods, and prints the
// differences that are not accepted by D-141.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** D-141: services of Directus that extensions do not get here (out of scope, Principle XI). */
export const ACCEPTED_MISSING = [
	'DeploymentService',
	'DeploymentProjectsService',
	'DeploymentRunsService',
	'WebSocketService',
];

function resolveModule(from, specifier) {
	const base = resolve(dirname(from), specifier.replace(/\.js$/, ''));
	return [`${base}.ts`, join(base, 'index.ts')].find((file) => existsSync(file));
}

function isPublic(member) {
	const flags = ts.getCombinedModifierFlags(member);
	if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static)) return false;
	return member.name && !ts.isPrivateIdentifier(member.name);
}

/** Exports of a module as { name: { kind, arity?, methods? } }, following `export *` and named re-exports. */
export function moduleExports(file, seen = new Set()) {
	const out = {};
	if (!file || seen.has(file)) return out;
	seen.add(file);

	const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

	for (const statement of source.statements) {
		if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
			const target = moduleExports(resolveModule(file, statement.moduleSpecifier.text), seen);

			if (!statement.exportClause) Object.assign(out, target);
			else if (ts.isNamedExports(statement.exportClause)) {
				for (const element of statement.exportClause.elements) {
					if (element.isTypeOnly) continue;
					const from = (element.propertyName ?? element.name).text;
					if (target[from]) out[element.name.text] = target[from];
				}
			}

			continue;
		}

		const exported = ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export;
		if (!exported) continue;

		if (ts.isClassDeclaration(statement) && statement.name) {
			const ctor = statement.members.find(ts.isConstructorDeclaration);

			const methods = statement.members
				.filter((m) => (ts.isMethodDeclaration(m) || ts.isGetAccessor(m)) && isPublic(m))
				.map((m) => m.name.getText(source))
				.sort();

			out[statement.name.text] = { kind: 'class', arity: ctor ? ctor.parameters.length : null, methods };
		} else if (ts.isFunctionDeclaration(statement) && statement.name) {
			out[statement.name.text] = { kind: 'function' };
		} else if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) out[declaration.name.text] = { kind: 'value' };
			}
		}
	}

	return out;
}

/** The modules apps/api/src/extensions/services.ts imports with `import('...')`, each export picked by name. */
function extraModules() {
	const file = join(ROOT, 'apps/api/src/extensions/services.ts');
	const text = readFileSync(file, 'utf8');
	return [...text.matchAll(/import\('([^']+)'\)/g)].map((match) => resolveModule(file, match[1]));
}

export function directusServices() {
	return moduleExports(join(ROOT, 'directus/api/src/services/index.ts'));
}

export function backofficeServices() {
	const out = moduleExports(join(ROOT, 'apps/api/src/services/index.ts'));
	const extraNames = [
		...readFileSync(join(ROOT, 'apps/api/src/extensions/services.ts'), 'utf8').matchAll(/^\t\t(\w+): /gm),
	].map((match) => match[1]);

	const extra = Object.assign({}, ...extraModules().map((file) => moduleExports(file)));

	for (const name of extraNames) if (extra[name]) out[name] = extra[name];

	return out;
}

/** The differences of the class exports, minus D-141. */
export function compare(directus = directusServices(), backoffice = backofficeServices()) {
	const problems = [];

	for (const [name, entry] of Object.entries(directus)) {
		if (entry.kind !== 'class' || ACCEPTED_MISSING.includes(name)) continue;

		const ours = backoffice[name];

		if (!ours || ours.kind !== 'class') {
			problems.push(`${name}: missing`);
			continue;
		}

		if (entry.arity !== null && ours.arity !== null && entry.arity !== ours.arity) {
			problems.push(`${name}: constructor takes ${ours.arity} parameter(s), Directus ${entry.arity}`);
		}

		const missing = entry.methods.filter((method) => !ours.methods.includes(method));
		if (missing.length > 0) problems.push(`${name}: missing method(s) ${missing.join(', ')}`);
	}

	return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const problems = compare();
	for (const problem of problems) console.error(problem);
	console.log(`extract-service-signatures: ${problems.length} difference(s)`);
	process.exitCode = problems.length > 0 ? 1 : 0;
}
