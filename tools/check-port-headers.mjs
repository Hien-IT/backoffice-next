// Checks every file listed in tools/port-manifest/*.json (arrays of { source, dest, header? }):
// dest exists, source exists under directus/, and the first line of dest names the source.
// `header: false` is for formats that cannot hold a comment (JSON); the manifest entry is then the record.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkPortHeaders(root) {
	const manifestDir = join(root, 'tools', 'port-manifest');
	const errors = [];
	let count = 0;

	if (!existsSync(manifestDir)) return { count, errors };

	for (const file of readdirSync(manifestDir)
		.filter((f) => f.endsWith('.json'))
		.sort()) {
		let entries;

		try {
			entries = JSON.parse(readFileSync(join(manifestDir, file), 'utf8'));
		} catch (err) {
			errors.push(`${file}: invalid JSON (${err.message})`);
			continue;
		}

		if (!Array.isArray(entries)) {
			errors.push(`${file}: must be an array of { source, dest }`);
			continue;
		}

		for (const { source, dest, header } of entries) {
			count++;

			if (!source || !dest) {
				errors.push(`${file}: entry without source or dest`);
				continue;
			}

			if (!existsSync(join(root, 'directus', source))) errors.push(`${file}: source directus/${source} does not exist`);

			const destPath = join(root, dest);

			if (!existsSync(destPath)) {
				errors.push(`${file}: dest ${dest} does not exist`);
				continue;
			}

			if (header === false) continue;

			const firstLine = readFileSync(destPath, 'utf8').split('\n', 1)[0];

			if (!firstLine.includes(`Ported from directus/${source}`)) {
				errors.push(`${file}: ${dest} first line must contain "Ported from directus/${source}"`);
			}
		}
	}

	return { count, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const { count, errors } = checkPortHeaders(resolve(process.argv[2] ?? '.'));

	for (const e of errors) console.error(e);
	console.log(`check-port-headers: ${count} ported file(s), ${errors.length} error(s)`);
	process.exit(errors.length ? 1 : 0);
}
