// Feature 002, research R9: the SchemaOverview of each app is read from the `schemaCache--done` message the
// process that builds the schema publishes on the shared bus. No debug endpoint is needed, and the test goes
// through the same wire format both apps use.
import type { SchemaOverview } from '@backoffice/types';
import { decodeMessage, newConnection, redis } from '../redis.js';

export type BusNamespaces = { busNs?: string; lockNs?: string };

const TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout: ${what}`)), TIMEOUT)),
	]);
}

/** Empties every in-memory schema, makes `appUrl` build it, and returns the message it publishes. */
export async function captureSchema(
	appUrl: string,
	{ busNs = 'directus:bus', lockNs = 'directus:lock' }: BusNamespaces = {},
): Promise<{ schema: SchemaOverview; raw: Buffer }> {
	const r = redis();
	await r.unlink(`${lockNs}:schemaCache--preparing`);

	const sub = newConnection();

	try {
		const message = new Promise<Buffer>((resolve) => sub.on('messageBuffer', (_channel, msg) => resolve(msg)));
		await sub.subscribe(`${busNs}:schemaCache--done`);

		await r.publish(`${busNs}:schemaChanged`, '{}');
		await new Promise((resolve) => setTimeout(resolve, 200));

		const res = await fetch(new URL('/server/info', appUrl));
		if (!res.ok) throw new Error(`GET /server/info on ${appUrl}: ${res.status}`);

		const raw = await withTimeout(message, `schemaCache--done from ${appUrl}`);
		const { schema } = decodeMessage(raw) as { schema: SchemaOverview };

		return { schema, raw };
	} finally {
		sub.disconnect();
	}
}

/**
 * Makes `appUrl` wait for another process (lock already at 1), then publishes `raw` as that process would: the app
 * answers its OAS request with the schema it received. Returns the OAS paths and components.
 */
export async function replaySchema(
	appUrl: string,
	raw: Buffer,
	{ busNs = 'directus:bus', lockNs = 'directus:lock' }: BusNamespaces = {},
): Promise<unknown> {
	const r = redis();
	const lock = `${lockNs}:schemaCache--preparing`;
	const channel = `${busNs}:schemaCache--done`;

	await r.publish(`${busNs}:schemaChanged`, '{}');
	await new Promise((resolve) => setTimeout(resolve, 200));
	await r.set(lock, 1);

	try {
		const response = fetch(new URL('/server/specs/oas', appUrl));

		await withTimeout(
			(async () => {
				while (((await r.pubsub('NUMSUB', channel)) as [string, number])[1] < 1) {
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
			})(),
			`${appUrl} waits on ${channel}`,
		);

		await r.publish(channel, raw);

		const res = await withTimeout(response, `OAS of ${appUrl}`);
		if (!res.ok) throw new Error(`GET /server/specs/oas on ${appUrl}: ${res.status} ${await res.text()}`);
		const { paths, components } = (await res.json()) as { paths: unknown; components: unknown };

		return { paths, components };
	} finally {
		await r.unlink(lock);
	}
}

/** OAS paths and components of `appUrl` (the parts that depend on the schema; info.version changes per request). */
export async function oasBody(appUrl: string): Promise<unknown> {
	const res = await fetch(new URL('/server/specs/oas', appUrl));
	if (!res.ok) throw new Error(`GET /server/specs/oas on ${appUrl}: ${res.status}`);
	const { paths, components } = (await res.json()) as { paths: unknown; components: unknown };
	return { paths, components };
}
