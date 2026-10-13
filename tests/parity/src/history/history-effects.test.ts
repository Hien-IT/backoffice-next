// Feature 008 (T005): the comparable form of the history rows that two apps write for the same steps.
import { expect, test } from 'vitest';
import { comparable, type HistoryRows } from './history-effects.js';

const empty: HistoryRows = {
	activity: [],
	revisions: [],
	versions: [],
	comments: [],
	notifications: [],
	versionKeys: {},
};

/** Rows of one app: serial ids, uuids and times of that run. */
function run(offset: number, commentId: string, versionId: string): HistoryRows {
	return {
		...empty,
		activity: [
			{
				id: 100 + offset,
				action: 'create',
				collection: 'posts',
				item: String(7 + offset),
				timestamp: new Date(),
				ip: '1.2.3.4',
			},
			{
				id: 101 + offset,
				action: 'version_save',
				collection: 'posts',
				item: String(7 + offset),
				timestamp: '2026-10-13 10:00:00',
			},
			{ id: 102 + offset, action: 'create', collection: 'directus_comments', item: commentId, timestamp: new Date() },
		],
		revisions: [
			{
				id: 50 + offset,
				activity: 100 + offset,
				parent: null,
				version: null,
				collection: 'posts',
				item: String(7 + offset),
				data: `{"id":${7 + offset},"title":"a"}`,
				delta: { id: 7 + offset, title: 'a' },
			},
			{
				id: 51 + offset,
				activity: 101 + offset,
				parent: 50 + offset,
				version: versionId,
				collection: 'posts',
				item: String(7 + offset),
				data: { title: 'b', _date: '2026-10-13T10:00:00.000Z', _user: 'u1' },
				delta: null,
			},
		],
		versions: [
			{
				id: versionId,
				key: 'draft',
				item: String(7 + offset),
				hash: 'h1',
				delta: '{"title":"b"}',
				date_created: new Date(),
				date_updated: null,
			},
		],
		comments: [
			{ id: commentId, collection: 'posts', item: String(7 + offset), comment: 'hi', date_created: new Date() },
		],
		notifications: [
			{
				id: 9 + offset,
				timestamp: new Date(),
				recipient: 'u2',
				subject: 'You were mentioned in posts',
				message: `<a href="http://x/admin/content/posts/${7 + offset}">${commentId}</a>`,
				item: String(7 + offset),
			},
		],
		versionKeys: { [versionId]: 'draft' },
	};
}

test('two runs with other ids and times compare equal', () => {
	const directus = comparable(run(0, '6f1c2a3e-0000-4000-8000-000000000001', 'aa1c2a3e-0000-4000-8000-000000000001'), {
		item: 7,
	});
	const backoffice = comparable(
		run(10, '6f1c2a3e-0000-4000-8000-000000000002', 'aa1c2a3e-0000-4000-8000-000000000002'),
		{ item: 17 },
	);

	expect(backoffice).toEqual(directus);
});

test('links between rows become indexes and version keys, JSON columns are parsed, times are markers', () => {
	const out = comparable(run(0, '6f1c2a3e-0000-4000-8000-000000000001', 'aa1c2a3e-0000-4000-8000-000000000001'), {
		item: 7,
	}) as any;

	expect(out.activity[0]).toEqual({
		action: 'create',
		collection: 'posts',
		item: '<item>',
		timestamp: '<time>',
		ip: '1.2.3.4',
	});
	expect(out.activity[2].item).toBe('<comment:0>');
	expect(out.revisions[0]).toMatchObject({
		activity: 0,
		parent: null,
		version: null,
		data: { id: '<item>', title: 'a' },
	});
	expect(out.revisions[1]).toMatchObject({
		activity: 1,
		parent: 0,
		version: 'key:draft',
		data: { _date: '<time>', _user: 'u1' },
	});
	expect(out.versions[0]).toEqual({
		key: 'draft',
		item: '<item>',
		hash: 'h1',
		delta: { title: 'b' },
		date_created: '<time>',
		date_updated: null,
	});
	// Ids are replaced inside text as whole tokens only.
	expect(out.notifications[0].message).toBe('<a href="http://x/admin/content/posts/<item>"><comment:0></a>');
	expect(out.notifications[0].item).toBe('<item>');
});

test('a link to a row written before the capture is marked, not dropped', () => {
	const rows = run(0, '6f1c2a3e-0000-4000-8000-000000000001', 'aa1c2a3e-0000-4000-8000-000000000001');
	rows.revisions[1]!['parent'] = 3;
	rows.revisions[1]!['version'] = 'bb000000-0000-4000-8000-000000000000';

	expect((comparable(rows) as any).revisions[1]).toMatchObject({ parent: '<outside>', version: 'key:<outside>' });
});
