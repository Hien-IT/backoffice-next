import { expect, test } from 'vitest';
import { UuidMap, normalizeLogs, normalizeRows, normalizeText } from './normalize.js';

test('branding, start command and program name (D-147)', () => {
	expect(normalizeText('Start Directus by running:')).toBe(normalizeText('Start Backoffice by running:'));
	expect(normalizeText('  npx directus start')).toBe(normalizeText('  node cli.js start'));
	expect(normalizeText('Usage: directus [command] [options]')).toBe('Usage: <app> [command] [options]');
	expect(normalizeText('Usage: backoffice [command] [options]')).toBe('Usage: <app> [command] [options]');
	expect(normalizeText('Usage: directus security key:generate [options]')).toBe(
		'Usage: <app> security key:generate [options]',
	);
	expect(normalizeText('Please run "directus bootstrap" first.')).toBe(
		normalizeText('Please run "backoffice bootstrap" first.'),
	);
	expect(normalizeText('Usage: directus database [options] [command]')).toBe(
		normalizeText('Usage: backoffice database [options] [command]'),
	);
});

test('the Directus table names stay', () => {
	expect(normalizeText('directus_users')).toBe('directus_users');
	expect(normalizeText("Database doesn't have Directus tables installed.")).toBe(
		"Database doesn't have <app> tables installed.",
	);
});

test('versions, directories, hashes, times and numbered uuids', () => {
	const uuids = new UuidMap();
	const text =
		'11.17.4 0.1.0 /tmp/init-a $argon2id$v=19$m=65536,t=3,p=4$abc$def 2026-10-22T03:04:05.678Z ' +
		'a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d A0B1C2D3-E4F5-4A6B-8C7D-9E0F1A2B3C4D ffffffff-ffff-4fff-8fff-ffffffffffff';

	expect(normalizeText(text, { versions: ['11.17.4', '0.1.0'], dirs: ['/tmp/init-a'], uuids })).toBe(
		'<version> <version> <dir> <argon2> <time> <uuid:1> <uuid:1> <uuid:2>',
	);
});

test('the update banner of the Directus image (D-149)', () => {
	const banner =
		'\n   ╭────╮\n   │ Update available! │\n   │ 11.17.4 → 12.5.0 │\n   ╰────╯\n\nUsage: directus start [options]';
	expect(normalizeText(banner)).toBe('\nUsage: <app> start [options]');
});

test('variable names renamed by the bundler of the Directus image', () => {
	expect(normalizeText('up$1 is not a function')).toBe('up is not a function');
	expect(normalizeText('foo$12 is not defined')).toBe('foo is not defined');
	expect(normalizeText('cost: $1 is not a price')).toBe('cost: $1 is not a price');
});

test('pino raw lines: level and msg only, other lines dropped', () => {
	const output = [
		'{"level":30,"time":1,"pid":7,"hostname":"a","msg":"Initializing bootstrap..."}',
		'2026-10-22T00:00:00: PM2 log: Launching in no daemon mode',
		'{"level":50,"time":2,"pid":7,"hostname":"a","msg":"Backoffice isn\'t installed"}',
	].join('\n');

	expect(normalizeLogs(output)).toEqual([
		{ level: 30, msg: 'Initializing bootstrap...' },
		{ level: 50, msg: "<app> isn't installed" },
	]);
});

test('rows: generated uuids, hashes and times compare equal, references stay consistent', () => {
	const run = (role: string, user: string, hash: string) => ({
		directus_roles: [{ id: role, name: 'Administrator' }],
		directus_users: [
			{ id: user, role, password: hash, last_access: '2026-10-22 01:02:03', email: 'admin@example.com' },
		],
		directus_revisions: [{ id: 1, data: JSON.stringify({ role, password: hash }) }],
	});

	const a = run(
		'11111111-1111-4111-8111-111111111111',
		'22222222-2222-4222-8222-222222222222',
		'$argon2id$v=19$m=65536,t=3,p=4$aaa$bbb',
	);
	const b = run(
		'99999999-9999-4999-8999-999999999999',
		'88888888-8888-4888-8888-888888888888',
		'$argon2id$v=19$m=65536,t=3,p=4$ccc$ddd',
	);

	expect(normalizeRows(b)).toEqual(normalizeRows(a));
	expect(normalizeRows(a)['directus_users']).toEqual([
		// Tables in name order: the revision names the role first (<uuid:1>), then the user gets <uuid:2>.
		{ id: '<uuid:2>', role: '<uuid:1>', password: '<argon2>', last_access: '<time>', email: 'admin@example.com' },
	]);
});

test('rows: a real difference stays visible', () => {
	expect(normalizeRows({ t: [{ id: 1, name: 'a' }] })).not.toEqual(normalizeRows({ t: [{ id: 1, name: 'b' }] }));
});
