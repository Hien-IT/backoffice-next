// Spec 032 US5 (FR-003, SC-005, contracts/tests.md §2b, profile sync): after comparisons (and, from wave 2, applies) the
// source token and host are nowhere at the target: not in the logs of both nodes, not in activity, not in revisions.
import { describe, expect, test } from 'vitest';
import { apply, diff, sourceToken, TARGET, target, targetLogs } from './helpers.js';

describe.skipIf(!TARGET)('profile sync: no trace of the source', () => {
	test('logs, activity and revisions of the target hold neither the token nor the source host', async () => {
		const token = await sourceToken();

		const compared = (await diff(['folders', 'flows'])).body.data;
		expect(compared.hash).toBeTruthy();
		// An apply too: a folder the target lacks, if any (folders run nothing, unlike flows).
		const row = compared.rows.find(
			(r: any) => r.kind === 'folder' && r.selectable && r.state === 'source_only' && r.depends.length === 0,
		);
		if (row) expect((await apply(compared, [row.id])).status).toBeLessThan(500);
		await target('POST', '/backoffice/sync/diff', {
			url: 'http://backoffice-api:8055',
			token: 'wrong-token',
			groups: ['folders'],
		});

		const logs = targetLogs();
		expect(logs).not.toContain(token);
		expect(logs).not.toContain('wrong-token');
		expect(logs).not.toContain('backoffice-api:8055');

		for (const path of ['/activity?limit=500&sort=-id', '/revisions?limit=500&sort=-id']) {
			const answer = await target('GET', path);
			expect(answer.status).toBe(200);
			const text = JSON.stringify(answer.body);
			expect(text).not.toContain(token);
			expect(text).not.toContain('backoffice-api:8055');
		}
	}, 120_000);
});
