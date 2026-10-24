// Constitution 3.1.0, principle IX (owner 2026-10-24): code comments in apps/web and apps/api write Directus as "DR".
// Fails on the word "Directus" inside a comment: TypeScript/JavaScript comments found by the TypeScript parser (strings,
// identifiers such as DirectusError and `@directus/*` imports are not comments), the script, template and style blocks
// of Vue files, CSS and HTML comments, and `#` comments of Dockerfiles and shell/conf files. The verbatim ports checked
// against the Directus source keep their comments: apps/api/src/database/migrations/** and seeds.
// Usage: node tools/check-dr-comments.mjs [root]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const APPS = ['apps/web', 'apps/api'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.vite', 'test-results', 'playwright-report']);
const SKIP_PATHS = [/^apps\/api\/src\/database\/migrations\//, /\/seeds\//];
const WORD = /\bDirectus\b/;

// The TypeScript parser of this checkout (apps/web depends on it), whatever root is checked.
const ts = createRequire(new URL('../apps/web/package.json', import.meta.url))('typescript');

function tsComments(text) {
	const t = ts;
	const sf = t.createSourceFile('x.ts', text, t.ScriptTarget.Latest, true, t.ScriptKind.TS);
	const ranges = new Map();
	const add = (list) => (list ?? []).forEach((r) => ranges.set(r.pos, [r.pos, r.end]));
	const visit = (node) => {
		add(t.getLeadingCommentRanges(text, node.pos));
		add(t.getTrailingCommentRanges(text, node.end));
		node.getChildren(sf).forEach(visit);
	};
	visit(sf);
	return [...ranges.values()];
}

const matches = (rx, text, offset = 0) =>
	[...text.matchAll(rx)].map((m) => [m.index + offset, m.index + offset + m[0].length]);
const blockComments = (text, offset) => matches(/\/\*[\s\S]*?\*\//g, text, offset);

/** Comment ranges of a file, or null when the file type has no comments the rule checks. */
export function commentRanges(root, file, text) {
	if (/\.(m?[jt]s|cjs)$/.test(file)) return tsComments(text);
	if (file.endsWith('.css')) return blockComments(text, 0);
	if (file.endsWith('.html')) return matches(/<!--[\s\S]*?-->/g, text);
	if (file.endsWith('.vue')) {
		const out = [];
		for (const m of text.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/g)) {
			const offset = m.index + m[1].length;
			out.push(...tsComments(m[2]).map(([a, b]) => [a + offset, b + offset]));
		}
		for (const m of text.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style>/g))
			out.push(...blockComments(m[2], m.index + m[1].length));
		const template = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, (block) => ' '.repeat(block.length));
		out.push(...matches(/<!--[\s\S]*?-->/g, template));
		return out;
	}
	if (/(Dockerfile|\.sh|\.conf|\.awk)$/.test(file)) return matches(/(^|\s)#[^\n]*/gm, text);
	return null;
}

function* walk(root, dir) {
	if (!existsSync(join(root, dir))) return;
	for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (SKIP_DIRS.has(entry.name) || entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) {
			yield* walk(root, path);
		} else yield path;
	}
}

/** Files git tracks (as CI sees them: local untracked files are left out), or every file outside a git checkout. */
function files(root) {
	try {
		const out = execFileSync('git', ['ls-files', '--', ...APPS], {
			cwd: root,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		const tracked = out.split('\n').filter(Boolean);
		if (tracked.length) return tracked;
	} catch {
		// not a git checkout
	}
	return APPS.flatMap((app) => [...walk(root, app)]);
}

export function checkDrComments(root = '.') {
	const errors = [];
	let count = 0;

	for (const file of files(root)) {
		if (!existsSync(join(root, file))) continue;
		if (SKIP_PATHS.some((rx) => rx.test(file))) continue;
		const text = readFileSync(join(root, file), 'utf8');
		if (!WORD.test(text)) continue;
		const ranges = commentRanges(root, file, text);
		if (!ranges) continue;
		count++;

		for (const [a, b] of ranges) {
			const comment = text.slice(a, b);
			const hit = comment.search(WORD);
			if (hit === -1) continue;
			const line = text.slice(0, a + hit).split('\n').length;
			errors.push(
				`${relative(resolve(root), resolve(root, file))}:${line}: write "DR" instead of "Directus" in a comment`,
			);
		}
	}

	return { count, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const { count, errors } = checkDrComments(process.argv[2] ?? '.');
	for (const error of errors) console.error(error);
	console.log(`check-dr-comments: ${count} file(s) with the word, ${errors.length} error(s)`);
	process.exitCode = errors.length ? 1 : 0;
}
