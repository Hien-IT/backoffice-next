// Spec 020 (T102, contracts/web.md, data-model §7): writes apps/web/fixtures/directus-components.json, the public
// contract of every global component, view and directive the Directus 11.17.4 app registers
// (directus/app/src/{components,views,directives}/register.ts): for each component its props (name, runtime types,
// required, default source), emits, slots (name and slot props from the template) and exposed members. The shim
// contract test (src/directus-shim/contract.test.ts) compares the shims with it. Run: `node scripts/extract-directus-components.mjs`
// from apps/web; extract-directus-components.test.ts runs it again and compares the bytes.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { compileScript, parse, registerTS } = require('vue/compiler-sfc');
const ts = require('typescript');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const APP = join(ROOT, 'directus/app/src');
export const OUT = join(ROOT, 'apps/web/fixtures/directus-components.json');

registerTS(() => ts);

/** `@/x` → directus/app/src/x; relative paths against the importing file; `.vue`, `.ts`, `/index.ts` tried in order. */
function resolveFile(from, specifier) {
	const base = specifier.startsWith('@/') ? join(APP, specifier.slice(2)) : resolve(dirname(from), specifier);
	const file = ['', '.vue', '.ts', '/index.ts', '/index.vue']
		.map((ext) => base + ext)
		.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());

	if (!file?.endsWith('index.ts')) return file;

	// A folder index that re-exports the component as default (views/private/index.ts): follow it.
	const index = readFileSync(file, 'utf8');
	const name = /export default (\w+)/.exec(index)?.[1];
	const source = name && new RegExp(`import\\s+${name}\\s+from\\s+'([^']+)'`).exec(index)?.[1];
	return source ? resolveFile(file, source) : file;
}

/** Registered name → file, from `app.component('Name', Import)` / `app.directive('name', Import)` and the imports. */
function registrations(file, method) {
	const text = readFileSync(file, 'utf8');
	const imports = new Map();

	for (const match of text.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)) imports.set(match[1], match[2]);
	for (const match of text.matchAll(/const\s+(\w+)\s*=\s*defineAsyncComponent\(\(\)\s*=>\s*import\('([^']+)'\)\)/g)) {
		imports.set(match[1], match[2]);
	}

	const out = {};

	for (const match of text.matchAll(new RegExp(`app\\.${method}\\('([^']+)',\\s*(\\w+)\\)`, 'g'))) {
		out[match[1]] = resolveFile(file, imports.get(match[2]));
	}

	return out;
}

const fsShim = {
	fileExists: (file) => existsSync(file),
	readFile: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
};

/** Text of a node of the compiled script. */
const text = (source, node) => source.text.slice(node.getStart(source), node.getEnd());

function objectKeys(source, node) {
	return node.properties.map((p) => (p.name ? p.name.getText(source).replace(/^['"]|['"]$/g, '') : text(source, p)));
}

/** props/emits/expose from the runtime code compileScript generates (types already turned into runtime props). */
function fromCompiled(code) {
	const source = ts.createSourceFile('c.ts', code, ts.ScriptTarget.Latest, true);
	const result = { props: {}, emits: [], expose: [] };

	const visit = (node) => {
		if (
			ts.isPropertyAssignment(node) &&
			node.name.getText(source) === 'props' &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			for (const prop of node.initializer.properties) {
				if (!ts.isPropertyAssignment(prop)) continue;
				const name = prop.name.getText(source).replace(/^['"]|['"]$/g, '');
				const entry = {};
				const value = prop.initializer;

				if (ts.isObjectLiteralExpression(value)) {
					for (const option of value.properties) {
						if (!ts.isPropertyAssignment(option)) continue;
						const key = option.name.getText(source);
						if (key === 'type') entry.type = text(source, option.initializer);
						if (key === 'required') entry.required = text(source, option.initializer) === 'true';
						if (key === 'default') entry.default = text(source, option.initializer);
					}
				} else entry.type = text(source, value);

				result.props[name] = entry;
			}
		}

		if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'emits') {
			const value = node.initializer;
			if (ts.isArrayLiteralExpression(value))
				result.emits = value.elements.map((e) => text(source, e).replace(/^['"]|['"]$/g, ''));
			else if (ts.isObjectLiteralExpression(value)) result.emits = objectKeys(source, value);
		}

		if (ts.isCallExpression(node) && /^(__expose|expose)$/.test(node.expression.getText(source)) && node.arguments[0]) {
			const arg = node.arguments[0];
			if (ts.isObjectLiteralExpression(arg)) result.expose = objectKeys(source, arg);
		}

		ts.forEachChild(node, visit);
	};

	visit(source);
	result.emits.sort();
	result.expose.sort();
	return result;
}

/** `<slot name="x" :a="..." v-bind:b>`: slot names (default when unnamed) and their bound props. */
function slotsOf(template) {
	const slots = {};

	for (const match of template.matchAll(/<slot\b([^>]*?)\/?>/g)) {
		const attrs = match[1];
		const named = /(?:^|\s)name="([^"]+)"/.exec(attrs);
		const dynamic = /(?:^|\s)(?::|v-bind:)name="([^"]+)"/.exec(attrs);
		const name = named ? named[1] : dynamic ? `[${dynamic[1]}]` : 'default';
		const props = [...attrs.matchAll(/(?:^|\s)(?::|v-bind:)([\w-]+)=/g)].map((m) => m[1]).filter((p) => p !== 'name');
		// v-bind="{ a, b: c }" passes an object of slot props
		const object = /(?:^|\s)v-bind="\{([^"]*)\}"/.exec(attrs);
		if (object)
			props.push(
				...object[1]
					.split(',')
					.map((part) => part.split(':')[0].trim())
					.filter(Boolean),
			);
		slots[name] = [...new Set([...(slots[name] ?? []), ...props])].sort();
	}

	return Object.fromEntries(Object.entries(slots).sort(([a], [b]) => a.localeCompare(b)));
}

export function describeComponent(file) {
	if (!file.endsWith('.vue')) return { file: file.slice(ROOT.length + 1), error: 'not a single file component' };

	const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file });
	const out = { file: file.slice(ROOT.length + 1), props: {}, emits: [], slots: {}, expose: [] };

	if (descriptor.script || descriptor.scriptSetup) {
		try {
			const compiled = compileScript(descriptor, { id: 'x', fs: fsShim });
			Object.assign(out, fromCompiled(compiled.content));
		} catch (error) {
			out.error = String(error.message).split('\n')[0];
		}
	}

	out.slots = slotsOf(descriptor.template?.content ?? '');
	return out;
}

export function extract() {
	const components = registrations(join(APP, 'components/register.ts'), 'component');
	const views = registrations(join(APP, 'views/register.ts'), 'component');
	const directives = registrations(join(APP, 'directives/register.ts'), 'directive');

	const sorted = (record, fn) =>
		Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((name) => [name, fn(record[name], name)]),
		);

	return {
		version: '11.17.4',
		components: sorted(components, (file) => describeComponent(file)),
		views: sorted(views, (file) =>
			file.endsWith('.vue') ? describeComponent(file) : { file: file.slice(ROOT.length + 1) },
		),
		directives: sorted(directives, (file) => ({ file: file.slice(ROOT.length + 1) })),
	};
}

export function render() {
	return `${JSON.stringify(extract(), null, '\t')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	writeFileSync(OUT, render());
	process.stdout.write(`wrote ${OUT}\n`);
}
