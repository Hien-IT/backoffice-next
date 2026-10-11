// Backoffice: Directus has no test for collection-exists.ts (feature 005, T009).
import type { SchemaOverview } from '@backoffice/types';
import type { Request, Response } from 'express';
import { expect, test } from 'vitest';
import { runMiddleware } from '../utils/run-middleware.js';
import collectionExists from './collection-exists.js';

const schema = {
	collections: {
		articles: { collection: 'articles', singleton: false },
		home: { collection: 'home', singleton: true },
		directus_settings: { collection: 'directus_settings', singleton: false },
		directus_users: { collection: 'directus_users', singleton: false },
	},
	relations: [],
} as unknown as SchemaOverview;

function run(params: Record<string, string>) {
	const req = { params, schema } as unknown as Request;
	return { req, done: runMiddleware(collectionExists, req, {} as Response) };
}

test('no collection param: nothing set', async () => {
	const { req, done } = run({});
	await done;
	expect(req.collection).toBeUndefined();
	expect(req.singleton).toBeUndefined();
});

test('unknown collection: 403 with the message of processAst, even for system names', async () => {
	for (const collection of ['nope', 'directus_nope', 'Articles']) {
		await expect(run({ collection }).done).rejects.toMatchObject({
			status: 403,
			code: 'FORBIDDEN',
			message: `You don't have permission to access collection "${collection}" or it does not exist. Queried in root.`,
		});
	}
});

test('user collections: singleton flag from the schema', async () => {
	const articles = run({ collection: 'articles' });
	await articles.done;
	expect(articles.req).toMatchObject({ collection: 'articles', singleton: false });

	const home = run({ collection: 'home' });
	await home.done;
	expect(home.req).toMatchObject({ collection: 'home', singleton: true });
});

test('system collections: singleton flag from the system data, not from the schema', async () => {
	const settings = run({ collection: 'directus_settings' });
	await settings.done;
	expect(settings.req).toMatchObject({ collection: 'directus_settings', singleton: true });

	const users = run({ collection: 'directus_users' });
	await users.done;
	expect(users.req).toMatchObject({ collection: 'directus_users', singleton: false });
});
