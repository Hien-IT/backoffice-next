// Feature 010 (T029, spec FR-090, FR-091, SC-005, research R8): every place where Directus 11.17.4 sends a mail has a
// counterpart here that writes a warning line instead, and this app has no code that could open a mail connection. A
// new `new MailService(` in a later Directus version makes this test fail, so no mail site is missed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const DIRECTUS_API = join(ROOT, 'directus/api/src');
const API = join(ROOT, 'apps/api/src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
	});
}

/** Directus file → the file of this app that replaces its mail with a warning line (D-23, D-27, D-28, D-33, D-34, D-36). */
const COUNTERPARTS: Record<string, { sites: number; file: string }> = {
	'services/users.ts': { sites: 3, file: 'services/users.service.ts' },
	'services/notifications.ts': { sites: 1, file: 'services/notifications.service.ts' },
	'services/shares.ts': { sites: 1, file: 'services/shares.service.ts' },
	'operations/mail/index.ts': { sites: 1, file: 'operations/mail/index.ts' },
};

test('the mail sites of Directus are the known ones, each with its warning line here', () => {
	const sites: Record<string, number> = {};

	for (const path of files(DIRECTUS_API)) {
		const count = readFileSync(path, 'utf8').split('new MailService(').length - 1;
		if (count > 0) sites[relative(DIRECTUS_API, path)] = count;
	}

	expect(sites).toEqual(Object.fromEntries(Object.entries(COUNTERPARTS).map(([file, { sites }]) => [file, sites])));

	for (const { file } of Object.values(COUNTERPARTS)) {
		expect(readFileSync(join(API, file), 'utf8'), file).toMatch(/mail sending is out of scope|not sent/);
	}
});

test('no code of this app can open a mail connection (SC-005)', () => {
	const pkg = readFileSync(join(ROOT, 'apps/api/package.json'), 'utf8');
	expect(pkg).not.toMatch(/nodemailer|mailgun|@aws-sdk\/client-ses/);

	// Spec 020 D-141: the log-only MailService handed to extensions; it has no transport (the checks below still apply).
	const logOnly = join(API, 'services/mail.service.ts');
	expect(readFileSync(logOnly, 'utf8')).toMatch(/mail sending is out of scope/);

	const offenders = files(API).filter((path) => {
		const text = readFileSync(path, 'utf8');
		if (path === logOnly) return /from ['"]nodemailer|EMAIL_TRANSPORT|sendMail\(/.test(text);
		return /from ['"](nodemailer|\.{1,2}\/.*services\/mail\/)|class MailService|EMAIL_TRANSPORT/.test(text);
	});

	expect(offenders.map((path) => relative(API, path))).toEqual([]);
});
