// Feature 008, US4 (spec FR-040 to FR-044, contracts/history-api.md §3): /comments at both apps. Errors go to both
// apps at once; writes run as scenarios with the history rows (comments, activity, revisions, notifications) each
// app writes: the sidebar flow, the app minimal permissions, mentions of readers and non-readers, a mention of a user
// that does not exist, and D-33 (no mail, a warning line).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { logs } from '../docker.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, BROWSER, call, historyCollection, same, snapHistory as snap, step } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_cmt_posts_${run}`;
const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const full = process.env['PARITY_SUITE'] !== 'reduced';

let item: string;
let author: TestUser; // app access, reads posts: the app minimal permissions on comments
let reader: TestUser; // reads posts: mentioned, notified
let outsider: TestUser; // app access only: mentioned, not notified
let mailer: TestUser; // reads posts, wants mail (D-33)
let stranger: TestUser; // no app access, no permission

const SIDEBAR = [
	'id',
	'comment',
	'date_created',
	'user_created.id',
	'user_created.email',
	'user_created.first_name',
	'user_created.last_name',
	'user_created.avatar.id',
	'user_created.avatar.modified_on',
];

beforeAll(async () => {
	await historyCollection(POSTS);
	item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'commented' })).data.id;

	const readsPosts = await createPolicy('directus', 'cmt-reads', {
		app: true,
		permissions: [{ collection: POSTS, action: 'read', fields: ['*'], permissions: {} }],
	});
	const appOnly = await createPolicy('directus', 'cmt-app', { app: true });

	author = await createUser('directus', 'cmt-author', { first_name: 'Ann', last_name: 'Lee' } as any);
	reader = await createUser('directus', 'cmt-reader', { first_name: 'Bo' } as any);
	outsider = await createUser('directus', 'cmt-outsider');
	mailer = await createUser('directus', 'cmt-mailer', { email_notifications: true } as any);
	stranger = await createUser('directus', 'cmt-stranger');

	for (const user of [author, reader, mailer]) await attachPolicy('directus', readsPosts, { user: user.id });
	await attachPolicy('directus', appOnly, { user: outsider.id });
	// email_notifications is true by default for new users: only the mailer keeps it.
	for (const user of [author, reader, outsider, stranger]) {
		await appRequest('directus', 'PATCH', `/users/${user.id}`, { email_notifications: false });
	}
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

describe('errors at both apps (contracts/history-api.md §3.1)', () => {
	it('the checks in order: user, comment, collection, item, read access of the item', async () => {
		const headers = await admin();

		await same({ method: 'POST', path: '/comments', body: { comment: 'x', collection: POSTS, item } });
		await same({ method: 'POST', path: '/comments', headers, body: {} });
		await same({ method: 'POST', path: '/comments', headers, body: { comment: 'x' } });
		await same({ method: 'POST', path: '/comments', headers, body: { comment: 'x', collection: POSTS } });
		await same({ method: 'POST', path: '/comments', headers, body: { comment: '', collection: POSTS, item } });
		await same({
			method: 'POST',
			path: '/comments',
			headers: bearer(outsider),
			body: { comment: 'x', collection: POSTS, item },
		});
		await same({
			method: 'POST',
			path: '/comments',
			headers: bearer(stranger),
			body: { comment: 'x', collection: POSTS, item },
		});
	});

	it('reads: the sidebar query, its count, a comment that does not exist, OPTIONS, HEAD', async () => {
		const headers = await admin();
		const filter = json({ _and: [{ collection: { _eq: POSTS } }, { item: { _eq: item } }] });

		await same({
			path: `/comments?filter[collection][_eq]=${POSTS}&filter[item][_eq]=${item}&sort=-date_created&fields=${SIDEBAR.join(',')}`,
			headers,
		});
		await same({ path: `/comments?filter=${filter}&aggregate[count]=id`, headers });
		await same({ path: `/comments/${randomUUID()}`, headers });

		for (const path of ['/comments', `/comments/${randomUUID()}`]) await same({ method: 'OPTIONS', path });
		await same({ method: 'HEAD', path: `/comments?filter=${filter}`, headers });
	});
});

describe('writes at each app (US4.1, US4.3)', () => {
	it('the sidebar flow: post, list, edit, delete, with the history rows', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = { ...(await admin()), ...BROWSER };
			const marker = `sidebar ${ctx.app}`;

			const created = await step(
				ctx,
				{ method: 'POST', path: '/comments', headers, body: { collection: POSTS, item, comment: marker } },
				'/comments',
				{ item, marker },
				(j) => ({ comment: j.data.id }),
			);
			const id = created.json.data.id as string;
			const ids = { item, marker, comment: id };

			const list = await call(ctx, {
				path: `/comments?filter=${json({ _and: [{ item: { _eq: item } }, { comment: { _eq: marker } }] })}&sort=-date_created&fields=${SIDEBAR.join(',')}`,
				headers,
			});
			const edited = await step(
				ctx,
				{ method: 'PATCH', path: `/comments/${id}`, headers, body: { comment: `${marker}!` } },
				'/comments/:pk',
				ids,
			);
			const deleted = await step(ctx, { method: 'DELETE', path: `/comments/${id}`, headers }, '/comments/:pk', ids);

			return { created: created.step, list: snap(list, '/comments', ids), edited: edited.step, deleted: deleted.step };
		});

		assertSameTranscripts(transcripts, 'sidebar flow');
		expect((transcripts.directus.created.history as any).comments).toHaveLength(1);
		expect((transcripts.directus.created.history as any).activity).toEqual([
			expect.objectContaining({ action: 'create', collection: 'directus_comments' }),
		]);
	});

	it('the app minimal permissions: own comments only, the comment field only', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = bearer(author);
			const theirs = (await appRequest('directus', 'POST', '/comments', { collection: POSTS, item, comment: 'theirs' }))
				.data.id as string;

			const created = await step(
				ctx,
				{ method: 'POST', path: '/comments', headers, body: { collection: POSTS, item, comment: 'own' } },
				'/comments',
				{ item, theirs },
				(j) => ({ own: j.data.id }),
			);
			const ids = { item, theirs, own: created.json.data.id as string };

			const mine = await call(ctx, {
				path: `/comments?filter=${json({ item: { _eq: item } })}&fields=id,comment&sort=comment`,
				headers,
			});
			const editOwn = await call(ctx, {
				method: 'PATCH',
				path: `/comments/${ids.own}`,
				headers,
				body: { comment: 'edited' },
			});
			const editOther = await call(ctx, {
				method: 'PATCH',
				path: `/comments/${ids.own}`,
				headers,
				body: { item: 'elsewhere' },
			});
			const editTheirs = await call(ctx, {
				method: 'PATCH',
				path: `/comments/${theirs}`,
				headers,
				body: { comment: 'x' },
			});
			const deleteTheirs = await call(ctx, { method: 'DELETE', path: `/comments/${theirs}`, headers });
			const deleteOwn = await call(ctx, { method: 'DELETE', path: `/comments/${ids.own}`, headers });
			await appRequest('directus', 'DELETE', `/comments/${theirs}`);

			return {
				created: created.step,
				mine: snap(mine, '/comments', ids),
				editOwn: snap(editOwn, '/comments/:pk', ids),
				editOther: snap(editOther, '/comments/:pk', ids),
				editTheirs: snap(editTheirs, '/comments/:pk', ids),
				deleteTheirs: snap(deleteTheirs, '/comments/:pk', ids),
				deleteOwn: snap(deleteOwn, '/comments/:pk', ids),
			};
		});

		assertSameTranscripts(transcripts, 'minimal permissions');
	});
});

describe('mentions (US4.2, spec FR-041, FR-042)', () => {
	it('readers notified, non-readers warned, same uuid in upper case counted again', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = { ...(await admin()), ...BROWSER };
			const comment = `hi @${reader.id}, @${outsider.id} and @${reader.id.toUpperCase()} (${ctx.app})`;
			const ids = { item, reader: reader.id, outsider: outsider.id, READER: reader.id.toUpperCase(), app: ctx.app };

			const created = await step(
				ctx,
				{ method: 'POST', path: '/comments', headers, body: { collection: POSTS, item, comment } },
				'/comments',
				ids,
				(j) => (j.data ? { comment: j.data.id } : {}),
			);
			return created.step;
		});

		assertSameTranscripts(transcripts, 'mentions');
		const notifications = (transcripts.directus.history as any).notifications;

		// The upper case uuid is read with UsersService.readOne outside the try of the loop. Where the key compares
		// without case (Postgres uuid, MySQL collation) it finds the reader: a second notification, to the id as written
		// (MySQL keeps the upper case), its name "@Unknown User". SQLite does not find it: 403 after the comment and the
		// first notification.
		if (transcripts.directus.response.status === 200) {
			expect(notifications.map((n: any) => String(n.recipient).toLowerCase())).toEqual(['<reader>', '<reader>']);
			expect(notifications[0].message).toContain('@Unknown User');
		} else {
			expect(transcripts.directus.response.status).toBe(403);
			expect(notifications.map((n: any) => n.recipient)).toEqual(['<reader>']);
		}

		for (const service of ['directus', 'backoffice-api']) {
			expect(logs(service), service).toContain(
				`User ${outsider.id} doesn't have proper permissions to receive notification for this item.`,
			);
		}
	});

	it('a mention of a user that does not exist: 403 after the comment was written', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const ghost = randomUUID();
			const created = await step(
				ctx,
				{
					method: 'POST',
					path: '/comments',
					headers: { ...(await admin()), ...BROWSER },
					body: { collection: POSTS, item, comment: `@${ghost}` },
				},
				'/comments',
				{ item, ghost },
			);
			return created.step;
		});

		assertSameTranscripts(transcripts, 'ghost mention');
		expect((transcripts.directus.history as any).comments).toHaveLength(1);
		expect(transcripts.directus.response.status).toBe(403);
	});

	it.runIf(full)(
		'D-33: a recipient who wants mail gets the same notification and a warning instead of a mail',
		async () => {
			const transcripts = await scenario(urls(), async (ctx) => {
				const created = await step(
					ctx,
					{
						method: 'POST',
						path: '/comments',
						headers: { ...(await admin()), ...BROWSER },
						body: { collection: POSTS, item, comment: `@${mailer.id} (${ctx.app})` },
					},
					'/comments',
					{ item, mailer: mailer.id, app: ctx.app },
					(j) => ({ comment: j.data.id }),
				);
				return created.step;
			});

			assertSameTranscripts(transcripts, 'mail recipient');
			expect(logs('backoffice-api')).toContain(
				`notification "You were mentioned in ${POSTS}" for ${mailer.email} not sent`,
			);
		},
	);
});
