// Spec 032 US2, US3, US4 (FR-017..FR-030, SC-002, contracts/tests.md §2b, profile sync): applying the ticked rows writes
// exactly them into the target, on both target nodes, with activity under the target admin; deletes take their cascade
// and never the admin; a change that would remove the caller's own admin access is refused.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { apply, diff, rowOf, source, sourceToken, TARGET, TARGET_2, target, uuid } from './helpers.js';
import { cleanup, newSeed, seed } from './seed.js';

const s = newSeed();
const GROUPS = [
	'schema',
	'flows',
	'access',
	'settings',
	'translations',
	'presets',
	'dashboards',
	'indexes',
	'folders',
	'extensions',
];

/** The ids plus every dependency they need (what the page ticks along). */
function withDepends(rows: any[], ids: string[]): string[] {
	const out = new Set<string>();
	const add = (id: string) => {
		if (out.has(id)) return;
		out.add(id);
		for (const dep of rowOf(rows, id)?.depends ?? []) add(dep);
		for (const dep of rowOf(rows, id)?.state === 'target_only' ? (rowOf(rows, id)?.cascade ?? []) : []) add(dep);
	};

	ids.forEach(add);
	return [...out];
}

const ok = (answer: { status: number; body: unknown }) => {
	expect(answer.status, JSON.stringify(answer.body)).toBeLessThan(300);
	return answer.body as any;
};

const untilReady = async (collection: string, name: string) => {
	for (let i = 0; i < 60; i++) {
		const list = ok(await target('GET', `/backoffice/collections/${collection}/indexes`));
		if (list.data.find((ix: any) => ix.name === name)?.status === 'ready') return;
		await new Promise((r) => setTimeout(r, 1000));
	}

	throw new Error(`index ${name} not ready`);
};

describe.skipIf(!TARGET)('profile sync: apply', () => {
	let extensionName: string | undefined;
	let extensionTargetId: string | undefined;

	beforeAll(async () => {
		await seed(s);
		// A target-only difference of settings and of an extension, so their rows are "changed" without touching the source.
		ok(await target('PATCH', '/settings', { project_descriptor: `target only ${s.run}` }));
		const extensions = ok(await target('GET', '/extensions')).data.filter(
			(e: any) => e.bundle === null && e.schema && e.meta.enabled,
		);
		if (extensions[0]) {
			extensionName = extensions[0].schema.name;
			extensionTargetId = extensions[0].id;
			ok(await target('PATCH', `/extensions/${extensionTargetId}`, { meta: { enabled: false } }));
		}
	}, 180_000);

	afterAll(async () => {
		if (extensionTargetId) await target('PATCH', `/extensions/${extensionTargetId}`, { meta: { enabled: true } });
		await cleanup(s);
	}, 180_000);

	test('US2/US3: ticked rows of every group are written, on both nodes, under the target admin; the rest stays', async () => {
		const compared = ok(await diff(GROUPS)).data;
		const rows = compared.rows;

		const ids = [
			`schema/collection:${s.collection}`,
			`flows/flow:${s.flow}`,
			`access/policy:${s.policy}`,
			`access/permission:${s.policy}:${s.collection}:read`,
			`access/link:${s.link}`,
			`translations/translation:en-US:${s.translationKey}`,
			`presets/preset:${s.collection}:${s.bookmark}`,
			`dashboards/dashboard:${s.dashboard}`,
			`folders/folder:${s.folder}`,
			'settings/field:project_descriptor',
			...(extensionName ? [`extensions/extension:${extensionName}`] : []),
		];

		for (const id of ids) expect(rowOf(rows, id), id).toMatchObject({ selectable: true });
		const before = ok(await target('GET', '/backoffice/sync/state?groups=flows,access')).data.state;

		const result = ok(await apply(compared, withDepends(rows, ids))).data;
		expect(result.created).toMatchObject({
			schema: 1,
			flows: 1,
			translations: 1,
			presets: 1,
			dashboards: 1,
			folders: 1,
		});
		expect(result.updated).toMatchObject({ access: 1, settings: 1 });
		expect(result.warnings).toEqual([]);

		const flow = ok(await target('GET', `/flows/${s.flow}?fields=*,operations.*`)).data;
		expect(flow).toMatchObject({ status: 'active', operation: s.operation });
		expect(flow.operations).toHaveLength(1);

		// FR-029: node 2 serves the new collection and runs the new flow without a restart.
		for (const base of [TARGET!, TARGET_2!]) {
			ok(await target('POST', `/items/${s.collection}`, { title: `from ${base}` }, { base }));
			expect((await target('GET', `/flows/trigger/${s.flow}`, undefined, { base })).status).toBeLessThan(300);
		}

		expect(ok(await target('GET', `/policies/${s.policy}`)).data.name).toBe(`Parity sync policy ${s.run}`);
		expect(
			ok(await target('GET', `/permissions?filter[policy][_eq]=${s.policy}&filter[collection][_eq]=${s.collection}`))
				.data,
		).toHaveLength(1);
		expect(ok(await target('GET', '/settings')).data.project_descriptor).toBe(
			(await source('GET', '/settings')).data.project_descriptor,
		);
		if (extensionTargetId) {
			const list = ok(await target('GET', '/extensions')).data;
			expect(list.find((e: any) => e.id === extensionTargetId).meta.enabled).toBe(true);
		}

		// FR-028: activity under the target admin, like a manual edit.
		const me = ok(await target('GET', '/users/me')).data.id;
		const activity = ok(
			await target(
				'GET',
				`/activity?filter[collection][_eq]=directus_flows&filter[item][_eq]=${s.flow}&fields=user,action`,
			),
		).data;
		expect(activity.length).toBeGreaterThan(0);
		expect(activity.every((a: any) => a.user === me)).toBe(true);

		// SC-002: rows not ticked are untouched (the target-only flow).
		const after = ok(await target('GET', '/backoffice/sync/state?groups=flows,access')).data.state;
		const own = (state: any) => state.flows.find((f: any) => f.id === s.targetFlow);
		expect(own(after)).toEqual(own(before));
	}, 240_000);

	test('US3: a new field alone, a collection toggle of 022, and an index built after the commit', async () => {
		await source('POST', `/fields/${s.collection}`, { field: 'subtitle', type: 'string', meta: {}, schema: {} });
		await source('PATCH', `/collections/${s.collection}`, { meta: { bo_show_search: false } });
		const created = await source(
			'POST',
			`/backoffice/collections/${s.collection}/indexes?concurrentIndexCreation=false`,
			{ fields: ['title'] },
		);
		const indexName = created.data.name;

		for (let i = 0; i < 30; i++) {
			const list = await source('GET', `/backoffice/collections/${s.collection}/indexes`);
			if (list.data.find((ix: any) => ix.name === indexName)?.status === 'ready') break;
			await new Promise((r) => setTimeout(r, 1000));
		}

		const compared = ok(await diff(['schema', 'indexes'])).data;
		const field = rowOf(compared.rows, `schema/field:${s.collection}.subtitle`);
		const collection = rowOf(compared.rows, `schema/collection:${s.collection}`);
		const index = rowOf(compared.rows, `indexes/index:${s.collection}:${indexName}`);

		expect(field).toMatchObject({ state: 'source_only' });
		expect(collection).toMatchObject({ state: 'changed' });
		expect(collection.changes.map((c: any) => c.path)).toContain('meta.bo_show_search');
		expect(index).toMatchObject({ state: 'source_only', selectable: true });

		const result = ok(await apply(compared, [field.id, collection.id, index.id])).data;
		expect(result.indexes).toEqual([
			{ collection: s.collection, name: indexName, action: 'create', status: 'creating' },
		]);

		const fields = ok(await target('GET', `/fields/${s.collection}`)).data.map((f: any) => f.field);
		expect(fields).toContain('subtitle');
		expect(ok(await target('GET', `/collections/${s.collection}`)).data.meta.bo_show_search).toBe(false);
		await untilReady(s.collection, indexName);
	}, 240_000);

	test('US4: a ticked delete takes its cascade; untick target rows stay; the admin policy cannot be ticked', async () => {
		const doomed = `parity_sync_del_${s.run}`;
		ok(
			await target('POST', '/collections', {
				collection: doomed,
				meta: {},
				schema: {},
				fields: [
					{
						field: 'id',
						type: 'integer',
						meta: { hidden: true },
						schema: { is_primary_key: true, has_auto_increment: true },
					},
				],
			}),
		);
		ok(await target('POST', '/presets', { collection: doomed, layout: 'tabular', bookmark: 'Doomed' }));

		const compared = ok(await diff(['schema', 'flows', 'access', 'presets'])).data;
		const row = rowOf(compared.rows, `schema/collection:${doomed}`);
		expect(row).toMatchObject({ state: 'target_only', impact: { items: 0 } });
		expect(row.cascade).toContain(`presets/preset:${doomed}:Doomed`);

		const admin = compared.rows.find(
			(r: any) => r.kind === 'policy' && r.state === 'target_only' && r.target?.admin_access === true,
		);
		expect(admin).toMatchObject({ selectable: false, reason: 'sync_admin_protected' });

		// Missing cascade → 400 before any write.
		const partial = await apply(compared, [row.id]);
		expect(partial.status).toBe(400);
		expect(partial.body.errors[0].extensions.reason).toMatch(/also deletes/);

		const result = ok(await apply(compared, withDepends(compared.rows, [row.id, `flows/flow:${s.targetFlow}`]))).data;
		expect(result.deleted).toMatchObject({ schema: 1, flows: 1 });
		expect((await target('GET', `/collections/${doomed}`)).status).toBe(403);
		expect((await target('GET', `/flows/${s.targetFlow}`)).status).toBe(403);
		expect(ok(await target('GET', `/presets?filter[collection][_eq]=${doomed}`)).data).toEqual([]);
	}, 240_000);

	test('FR-027: a change that removes the caller own admin access is refused and nothing changes', async () => {
		const role = uuid();
		const policy = uuid();
		const link = uuid();
		const token = `sync-admin-2-${s.run}`;

		ok(await target('POST', '/roles', { id: role, name: `Second admins ${s.run}` }));
		ok(
			await target('POST', '/policies', {
				id: policy,
				name: `Second admin policy ${s.run}`,
				admin_access: true,
				app_access: true,
			}),
		);
		ok(await target('POST', '/access', { id: link, role, policy }));
		const user = ok(
			await target('POST', '/users', {
				email: `sync-admin-2-${s.run}@example.com`,
				password: 'x-password-x',
				role,
				token,
			}),
		).data;

		try {
			const asSecond = await target(
				'POST',
				'/backoffice/sync/diff',
				{ url: 'http://backoffice-api:8055', token: await sourceToken(), groups: ['access'] },
				{ token },
			);
			const compared = ok(asSecond).data;
			expect(rowOf(compared.rows, `access/policy:${policy}`)).toMatchObject({
				selectable: false,
				reason: 'sync_admin_protected',
			});

			const refused = await target(
				'POST',
				'/backoffice/sync/apply',
				{
					url: 'http://backoffice-api:8055',
					token: await sourceToken(),
					hash: compared.hash,
					groups: ['access'],
					selected: [`access/link:${link}`],
				},
				{ token },
			);

			expect(refused.status).toBe(400);
			expect(refused.body.errors[0].extensions.reason).toBe('This change would remove your own admin access');
			expect((await target('GET', `/access/${link}`)).status).toBe(200);
		} finally {
			await target('DELETE', `/users/${user.id}`);
			await target('DELETE', `/access/${link}`);
			await target('DELETE', `/policies/${policy}`);
			await target('DELETE', `/roles/${role}`);
		}
	}, 240_000);
});
