// Feature 010, US3 (spec FR-004, FR-030, FR-031, contracts/system-api.md §2, §6): /notifications at both apps. Reads
// go to both apps at once (the bell query of stores/notifications.ts); writes run as scenarios with the rows each app
// writes. No mail is sent: each notification for a user with an email and email_notifications on is one warning line
// at Backoffice (D-33). The notifications.create action of a flow runs at the app that got the request (009).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { cleanupFlows, runRows, seedFlow, settled, until } from '../flows/helpers.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, systemEffects, warnLines } from './helpers.js';

const MAIL_WARNING = 'mail sending is out of scope; notification';
const full = process.env['PARITY_SUITE'] !== 'reduced';

let reader: TestUser; // app access, email_notifications off: reads and archives its notifications
let mailer: TestUser; // app access, email_notifications on: one warning line per notification at Backoffice
let other: TestUser;
let foreign: number;
const flows: string[] = [];

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

beforeAll(async () => {
	const appPolicy = await createPolicy('directus', 'notif-app', { app: true });
	reader = await createUser('directus', 'notif-reader');
	mailer = await createUser('directus', 'notif-mailer', { email_notifications: true } as any);
	other = await createUser('directus', 'notif-other');

	for (const user of [reader, mailer, other]) await attachPolicy('directus', appPolicy, { user: user.id });
	for (const user of [reader, other])
		await appRequest('directus', 'PATCH', `/users/${user.id}`, { email_notifications: false });

	await appRequest('directus', 'POST', '/notifications', [
		{ recipient: reader.id, subject: 'one', message: 'first' },
		{ recipient: reader.id, subject: 'two', status: 'archived' },
	]);
	foreign = (await appRequest('directus', 'POST', '/notifications', { recipient: other.id, subject: 'theirs' })).data
		.id;
}, 300_000);

afterAll(async () => {
	await hostDb()('directus_notifications').whereIn('recipient', [reader.id, mailer.id, other.id]).delete();
	await cleanupFlows(flows);
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('reads at both apps', () => {
	it('the bell count and the drawer list of the app, as the recipient', async () => {
		const headers = bearer(reader);
		const inbox = { _and: [{ recipient: { _eq: reader.id } }, { status: { _eq: 'inbox' } }] };

		await same({ path: `/notifications?filter=${json(inbox)}&aggregate[count]=id`, headers });
		await same({ path: `/notifications?filter=${json(inbox)}&sort=-id&fields=id,subject,message,status`, headers });
		await same({ path: `/notifications?filter[status][_eq]=archived&sort=-id`, headers });
	});

	it('only own notifications for the app minimal permissions; admin sees all; public 403', async () => {
		await same({ path: `/notifications/${foreign}`, headers: bearer(reader) });
		await same({ path: `/notifications?filter[recipient][_eq]=${other.id}`, headers: bearer(reader) });
		await same({ path: `/notifications/${foreign}?fields=id,recipient.email`, headers: await admin() });
		await same({ path: '/notifications' });
		await same({ method: 'OPTIONS', path: '/notifications' });
		await same({ method: 'OPTIONS', path: `/notifications/${foreign}` });
	});
});

describe('writes as scenarios', () => {
	it('admin creates one and an array; the recipient archives them (status only); other fields 403', async () => {
		let warnings = 0;

		const transcripts = await scenario(urls(), async (ctx) => {
			const before = warnLines('backoffice-api', MAIL_WARNING);
			const { result, rows } = await systemEffects(['notifications'], async () => [
				await call(ctx, {
					method: 'POST',
					path: '/notifications',
					headers: await admin(),
					body: { recipient: reader.id, subject: 'single', message: '**md**' },
				}),
				await call(ctx, {
					method: 'POST',
					path: '/notifications?fields=id,subject,recipient',
					headers: await admin(),
					body: [
						{ recipient: mailer.id, subject: 'mail-1' },
						{ recipient: mailer.id, subject: 'mail-2', collection: 'directus_users', item: mailer.id },
					],
				}),
			]);

			const keys = (rows.notifications ?? []).map((row) => row['id'] as number);
			const ids = Object.fromEntries(keys.map((k, i) => [`n${i}`, k]));
			const strings = Object.fromEntries(Object.entries(ids).map(([n, k]) => [n, String(k)]));

			const archive = await call(ctx, {
				method: 'PATCH',
				path: '/notifications',
				headers: bearer(reader),
				body: { keys: [keys[0]], data: { status: 'archived' } },
			});
			const forbidden = await call(ctx, {
				method: 'PATCH',
				path: `/notifications/${keys[0]}`,
				headers: bearer(reader),
				body: { subject: 'changed' },
			});
			const theirs = await call(ctx, {
				method: 'PATCH',
				path: `/notifications/${keys[1]}`,
				headers: bearer(reader),
				body: { status: 'archived' },
			});
			const deleted = await call(ctx, { method: 'DELETE', path: '/notifications', headers: await admin(), body: keys });
			if (ctx.app === 'backoffice') warnings = warnLines('backoffice-api', MAIL_WARNING) - before;

			return {
				created: result.map((res) => snap(res, '/notifications', strings)),
				rows: comparable(rows, { ...ids, reader: reader.id, mailer: mailer.id }),
				archive: snap(archive, '/notifications', strings),
				forbidden: snap(forbidden, '/notifications', strings),
				theirs: snap(theirs, '/notifications', strings),
				deleted: snap(deleted, '/notifications', strings),
			};
		});

		assertSameTranscripts(transcripts, 'notifications');
		// D-33: the two notifications of the mailer, none for the reader (email_notifications off).
		expect(warnings).toBe(2);
	});
});

describe.runIf(full)('the notifications.create event of a flow (FR-004)', () => {
	it('runs once, at the app that got the request', async () => {
		const { id } = await seedFlow({
			trigger: 'event',
			options: { type: 'action', scope: ['items.create'], collections: ['directus_notifications'] },
			operations: [{ key: 'log', type: 'log', options: { message: 'notification event {{ $trigger.event }}' } }],
		});
		flows.push(id, await settled());

		for (const app of ['directus', 'backoffice'] as const) {
			const last = Number((await hostDb().max({ m: 'id' }).from('directus_activity').first())?.['m'] ?? 0);
			await appRequest(app, 'POST', '/notifications', { recipient: reader.id, subject: `event at ${app}` });

			expect(await until(async () => (await runRows(id, last)).length === 1), app).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect((await runRows(id, last)).length, app).toBe(1);
		}
	});
});
