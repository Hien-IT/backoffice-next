// Shared helpers of the feature 002 parity tests: public permissions through the Directus API and the OpenAPI
// component of a collection, the place where the public sees the schema of each app.
import { directusRequest } from '../directus-api.js';
import { clearResponseCache } from '../redis.js';

let publicPolicy: string | undefined;

export async function getPublicPolicy(baseUrl?: string): Promise<string> {
	if (publicPolicy) return publicPolicy;
	const filter = encodeURIComponent(JSON.stringify({ name: { _eq: '$t:public_label' } }));
	const { data } = await directusRequest('GET', `/policies?fields=id&filter=${filter}`, undefined, baseUrl);
	publicPolicy = data[0].id as string;
	return publicPolicy;
}

/** Creates `collection` (integer id + the given fields) and lets the public read it. Returns the permission id. */
export async function createPublicCollection(
	collection: string,
	fields: Record<string, unknown>[] = [{ field: 'title', type: 'string' }],
	permission: Record<string, unknown> = {},
	baseUrl?: string,
): Promise<number> {
	await directusRequest(
		'POST',
		'/collections',
		{
			collection,
			schema: {},
			meta: {},
			fields: [
				{
					field: 'id',
					type: 'integer',
					meta: { hidden: true },
					schema: { is_primary_key: true, has_auto_increment: true },
				},
				...fields,
			],
		},
		baseUrl,
	);

	const { data } = await directusRequest(
		'POST',
		'/permissions',
		{
			policy: await getPublicPolicy(baseUrl),
			collection,
			action: 'read',
			fields: ['*'],
			permissions: {},
			...permission,
		},
		baseUrl,
	);

	return data.id as number;
}

/** Deletes collections created by a test, ignoring those already gone. */
export async function dropCollections(collections: string[], baseUrl?: string): Promise<void> {
	for (const collection of collections) {
		const filter = encodeURIComponent(JSON.stringify({ collection: { _eq: collection } }));
		const { data } = await directusRequest('GET', `/permissions?fields=id&filter=${filter}`, undefined, baseUrl);
		for (const { id } of data) await directusRequest('DELETE', `/permissions/${id}`, undefined, baseUrl);
		await directusRequest('DELETE', `/collections/${collection}`, undefined, baseUrl).catch(() => undefined);
	}
}

/** The OpenAPI component schema of `collection` as seen by the public, or undefined when it is not in the spec. */
export async function oasComponent(appUrl: string, collection: string): Promise<Record<string, any> | undefined> {
	await clearResponseCache();
	const res = await fetch(new URL('/server/specs/oas', appUrl));
	if (!res.ok) throw new Error(`GET /server/specs/oas on ${appUrl}: ${res.status}`);
	const spec = (await res.json()) as { components?: { schemas?: Record<string, Record<string, any>> } };

	return Object.values(spec.components?.schemas ?? {}).find((schema) => schema['x-collection'] === collection);
}

/** Polls `check` until it returns true; resolves with the elapsed milliseconds, rejects after `timeoutMs`. */
export async function within(timeoutMs: number, check: () => Promise<boolean>, what: string): Promise<number> {
	const start = Date.now();

	for (;;) {
		if (await check()) return Date.now() - start;
		if (Date.now() - start > timeoutMs) throw new Error(`not within ${timeoutMs} ms: ${what}`);
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}
