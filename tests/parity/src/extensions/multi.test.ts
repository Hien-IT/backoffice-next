// Spec 020 US2 (FR-040 to FR-044, SC-003, T061): three nodes on one database and one storage location (Directus 8155,
// Backoffice 8156, the second Backoffice 8157 of profile `multi`). A change made at one node reaches the others within
// 10 s (from the response of the request): disabling an endpoint, a new extension folder on the storage, a disabled
// hook. Each node is called on its own port.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { admin, ensureExtensionCollections, extLog, extRows, lastLogId, mc, nodes, waitAll } from './helpers.js';

beforeAll(async () => {
	await ensureExtensionCollections();
});

afterAll(async () => {
	await closeHostDb();
});

const json = { 'content-type': 'application/json' };

async function patch(url: string, id: string, enabled: boolean) {
	const res = await fetch(`${url}/extensions/${id}`, {
		method: 'PATCH',
		headers: { ...(await admin()), ...json },
		body: JSON.stringify({ meta: { enabled } }),
	});

	expect([200, 204]).toContain(res.status);
}

/** Every node answers `path` with `status` within 10 s of now. */
const everywhere = (path: string, status: number) =>
	waitAll(async () => {
		for (const node of nodes()) {
			const res = await fetch(`${node.url}${path}`);
			if (res.status !== status) throw new Error(`${node.name} ${path}: ${res.status}, expected ${status}`);
		}
	});

const rowOf = async (folder: string) => (await extRows()).find((row) => row.folder === folder && row.bundle === null)!;

describe('one change, every node', () => {
	it('disabled at 8156: 404 at the three nodes within 10 s; enabled again: 200', async () => {
		const [, backoffice] = nodes();
		const row = await rowOf('parity-endpoint-demo');

		await patch(backoffice!.url, row.id, false);

		try {
			await everywhere('/parity-endpoint-demo', 404);
		} finally {
			await patch(backoffice!.url, row.id, true);
		}

		await everywhere('/parity-endpoint-demo', 200);
	});

	it('a new folder on the storage: after a reload every node serves it, with one row (R-58)', async () => {
		const folder = `parity-multi-${randomUUID().slice(0, 8)}`;
		const [directus] = nodes();
		const other = await rowOf('parity-display-badge');

		mc(
			`echo '{"name":"${folder}","version":"1.0.0","type":"module","directus:extension":{"type":"endpoint","path":"dist/index.js","source":"src/index.js","host":"^11.0.0"}}' | mc pipe local/directus/extensions/${folder}/package.json && ` +
				`echo 'export default (router) => router.get("/", (_req, res) => res.json({ multi: true }));' | mc pipe local/directus/extensions/${folder}/dist/index.js`,
		);

		try {
			// Any change broadcasts a reload; every node syncs the whole location.
			await patch(directus!.url, other.id, false);
			await patch(directus!.url, other.id, true);

			await everywhere(`/${folder}`, 200);
			expect((await extRows()).filter((row) => row.folder === folder)).toHaveLength(1);
		} finally {
			mc(`mc rm --recursive --force local/directus/extensions/${folder}`);
			await patch(directus!.url, other.id, false);
			await patch(directus!.url, other.id, true);
			await everywhere(`/${folder}`, 404);
			await hostDb()('directus_extensions').where({ folder }).delete();
		}
	});

	it('a hook disabled at 8157: an item created through 8156 is not logged (US2-3)', async () => {
		const [, backoffice, second] = nodes();
		const row = await rowOf('parity-hook-audit');
		const tag = `multi-${randomUUID().slice(0, 8)}`;

		await patch(second!.url, row.id, false);

		try {
			// The items.create filter of the hook sets `audited`; init middlewares stay until a restart, as Directus.
			const start = await lastLogId();

			await waitAll(async () => {
				const res = await fetch(`${backoffice!.url}/items/bo_ext_items`, {
					method: 'POST',
					headers: { ...(await admin()), ...json, 'x-bo-ext-trace': tag },
					body: JSON.stringify({ title: tag }),
				});

				const { data } = (await res.json()) as { data: { audited: boolean | null } };
				if (data.audited === true) throw new Error('hook still loaded at 8156');
			});

			const logged = (await extLog(start)).filter((r) => (r.payload as { tag?: string })?.tag === tag);
			// Rows written while 8156 had not reloaded yet come before the last create: the last create logs nothing.
			const items = await hostDb()('bo_ext_items').where({ title: tag }).orderBy('id');
			const last = items.at(-1)!;
			expect(
				logged.filter((r) => JSON.stringify((r.payload as { keys: unknown }).keys) === JSON.stringify([last['id']])),
			).toEqual([]);
		} finally {
			await patch(second!.url, row.id, true);
		}
	});
});
