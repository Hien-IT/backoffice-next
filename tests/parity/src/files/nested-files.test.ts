// Feature 007, US3 scenario 5 (spec FR-017): nested writes to directus_files from a user collection (m2o `image`) and
// from directus_users.avatar go through FilesService at both apps (a file without `type` fails like Directus).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { cleanup, createField, createUser, createUserCollection } from '../permissions/fixtures.js';
import { admin, call, idsOf, snap } from './helpers.js';

const run = Math.random().toString(16).slice(2, 8);
const COLLECTION = `parity_files_nested_${run}`;
const files: string[] = [];

beforeAll(async () => {
	await createUserCollection(COLLECTION, [{ field: 'title', type: 'string' }], { primaryKey: 'uuid' });
	await createField(COLLECTION, { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } });
	await appRequest('directus', 'POST', '/relations', {
		collection: COLLECTION,
		field: 'image',
		related_collection: 'directus_files',
		schema: { on_delete: 'SET NULL' },
	});
}, 300_000);

afterAll(async () => {
	if (files.length) await appRequest('directus', 'DELETE', '/files', files.splice(0)).catch(() => undefined);
	await cleanup();
	await closeHostDb();
}, 300_000);

describe('nested file writes (US3 scenario 5, FR-017)', () => {
	it('an item creates and updates its image row through FilesService', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();

			const created = await call(ctx, {
				method: 'POST',
				path: `/items/${COLLECTION}?fields=*,image.*`,
				headers,
				body: { title: 'a', image: { type: 'image/png', storage: 'local', filename_download: 'n.png', title: 'N' } },
			});

			const data = (created.json as any)?.data ?? {};
			const ids = { item: data.id, file: data.image?.id };
			files.push(ids.file);

			const updated = await call(ctx, {
				method: 'PATCH',
				path: `/items/${COLLECTION}/${ids.item}?fields=image.title`,
				headers,
				body: { image: { id: ids.file, title: 'N2' } },
			});

			const noType = await call(ctx, {
				method: 'POST',
				path: `/items/${COLLECTION}`,
				headers,
				body: { title: 'b', image: { storage: 'local', filename_download: 'x.png' } },
			});

			return {
				created: snap(created, '/items', ids),
				updated: snap(updated, '/items', ids),
				noType: snap(noType, '/items'),
			};
		});

		assertSameTranscripts(transcripts, 'nested file writes');
		expect(transcripts.directus.noType.status).toBe(400);
	});

	it('PATCH /users/:id with a nested avatar row', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const user = await createUser('directus', `avatar-${run}-${ctx.app}`);
			const headers = await admin();

			const res = await call(ctx, {
				method: 'PATCH',
				path: `/users/${user.id}?fields=avatar.title,avatar.type,avatar.storage`,
				headers,
				body: { avatar: { type: 'image/jpeg', storage: 'local', filename_download: 'me.jpg', title: 'Me' } },
			});

			const avatar = await appRequest('directus', 'GET', `/users/${user.id}?fields=avatar`);
			if (avatar.data.avatar) files.push(avatar.data.avatar);

			return { res: snap(res, '/users/:pk', { user: user.id }), ids: idsOf(res).length };
		});

		assertSameTranscripts(transcripts, 'nested avatar');
	});
});
