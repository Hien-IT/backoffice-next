// Builds every fixture extension with the Directus extensions SDK (`directus-extension build`), like a real extension
// author, so dist/ is what Directus 11.17.4 loads. `--pack` also writes <name>-<version>.tgz for the fake registry.
// Usage: node scripts/build.mjs [--pack] [--out <dir>] [name...]
import { execFile, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'node_modules', '.bin', 'directus-extension');

export function listFixtures() {
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'package.json')))
		.map((entry) => entry.name)
		.filter((name) => 'directus:extension' in JSON.parse(readFileSync(join(root, name, 'package.json'), 'utf8')))
		.sort();
}

/**
 * Builds one fixture into `outDir/<name>` (default: in place) and resolves the dist folder. Async: a synchronous build
 * blocks the Vitest worker for minutes on CI ("Timeout calling onTaskUpdate").
 */
export async function buildFixture(name, outDir) {
	let cwd = join(root, name);

	if (outDir) {
		const copy = join(outDir, name);
		rmSync(copy, { recursive: true, force: true });
		mkdirSync(copy, { recursive: true });
		cpSync(join(root, name, 'package.json'), join(copy, 'package.json'));
		cpSync(join(root, name, 'src'), join(copy, 'src'), { recursive: true });
		cwd = copy;
	}

	rmSync(join(cwd, 'dist'), { recursive: true, force: true });
	await promisify(execFile)(cli, ['build'], { cwd });
	return join(cwd, 'dist');
}

export function packFixture(name) {
	// npm pack takes every file of the folder: an earlier tarball would end up inside the new one.
	for (const file of readdirSync(join(root, name))) if (file.endsWith('.tgz')) rmSync(join(root, name, file));

	execFileSync('npm', ['pack', '--silent', '--pack-destination', join(root, name)], {
		cwd: join(root, name),
		stdio: 'pipe',
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2);
	const pack = args.includes('--pack');
	const outIndex = args.indexOf('--out');
	const out = outIndex >= 0 ? resolve(args[outIndex + 1]) : undefined;
	const names = args.filter((arg, i) => !arg.startsWith('--') && (outIndex < 0 || i !== outIndex + 1));

	for (const name of names.length ? names : listFixtures()) {
		await buildFixture(name, out);
		if (pack) packFixture(name);
		console.log(`built ${name}`);
	}
}
