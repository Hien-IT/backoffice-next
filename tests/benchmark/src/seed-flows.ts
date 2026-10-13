// Seed of the flows benchmark (feature 009, contracts/parity.md §6, research R13): a collection of ITEMS items (host
// batch insert), FLOWS manual flows of three operations each for GET /flows, the webhook flow `webhook-sync` (transform,
// condition, item-read of one item, return $last, accountability null so no run log per request) and the webhook flow
// `webhook-exec` (exec returning {ok: true}), made through the Directus API so both apps reload them through the bus.
import { randomBytes } from 'node:crypto';
import { db, directus } from './seed-permissions.ts';

const ITEMS = Number(process.env['BENCH_FLOWS_ITEMS'] ?? 1000);
const FLOWS = Number(process.env['BENCH_FLOWS'] ?? 50);

export interface FlowsSeed {
	tag: string;
	collection: string;
	token: string;
	flows: { sync: string; exec: string };
	seconds: number;
}

/** A flow with its operations, the first one as its root, each resolving to the next. */
async function flow(body: Record<string, unknown>, operations: { key: string; type: string; options: unknown }[]) {
	const id = (await directus('POST', '/flows', { status: 'active', ...body })).data.id as string;
	let next: string | null = null;

	for (const [i, op] of [...operations].reverse().entries()) {
		next = (
			await directus('POST', '/operations', {
				...op,
				name: op.key,
				position_x: 19 * (operations.length - i),
				position_y: 1,
				flow: id,
				resolve: next,
			})
		).data.id as string;
	}

	if (next) await directus('PATCH', `/flows/${id}`, { operation: next });
	return id;
}

export async function seed(): Promise<FlowsSeed> {
	const started = Date.now();
	const tag = `bench-flows-${randomBytes(3).toString('hex')}`;
	const collection = `bench_flows_${tag.slice(-6)}`;

	await directus('POST', '/collections', {
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
			{ field: 'title', type: 'string' },
		],
	});

	for (let i = 0; i < ITEMS; i += 500) {
		await db(collection).insert(
			Array.from({ length: Math.min(500, ITEMS - i) }, (_, j) => ({ title: `${tag} item ${i + j}` })),
		);
	}

	const token = `${tag}-admin`;
	const policy = (
		await directus('POST', '/policies', { name: `${tag}-admin`, icon: 'badge', admin_access: true, app_access: true })
	).data.id as string;
	const user = (await directus('POST', '/users', { email: `${tag}-admin@example.com`, token, status: 'active' })).data
		.id as string;
	await directus('POST', '/access', { user, policy });

	for (let i = 0; i < FLOWS; i++) {
		await flow({ name: `${tag} manual ${i}`, trigger: 'manual', options: { collections: [collection] } }, [
			{ key: 'shape', type: 'transform', options: { json: { keys: '{{ $trigger.body.keys }}' } } },
			{ key: 'check', type: 'condition', options: { filter: { $last: { keys: { _nnull: true } } } } },
			{ key: 'note', type: 'log', options: { message: 'ran' } },
		]);
	}

	const first = (await db(collection).min({ id: 'id' }).first())?.['id'];
	const webhook = { trigger: 'webhook', accountability: null, options: { method: 'POST', return: '$last' } };

	const sync = await flow({ name: `${tag} webhook-sync`, ...webhook }, [
		{ key: 'shape', type: 'transform', options: { json: { n: '{{ $trigger.body.n }}' } } },
		{ key: 'check', type: 'condition', options: { filter: { $trigger: { body: { n: { _nnull: true } } } } } },
		{ key: 'read', type: 'item-read', options: { collection, key: [String(first)], permissions: '$full' } },
	]);

	const exec = await flow({ name: `${tag} webhook-exec`, ...webhook }, [
		{ key: 'run', type: 'exec', options: { code: 'module.exports = async function () { return { ok: true }; };' } },
	]);

	return { tag, collection, token, flows: { sync, exec }, seconds: Math.round((Date.now() - started) / 1000) };
}

export async function cleanup(seeded: FlowsSeed): Promise<void> {
	const flows = await db('directus_flows').select('id').where('name', 'like', `${seeded.tag}%`);
	if (flows.length)
		await directus(
			'DELETE',
			'/flows',
			flows.map((f) => f.id),
		);

	await directus('DELETE', `/collections/${seeded.collection}`);

	const users = await db('directus_users').select('id').where('email', 'like', `${seeded.tag}%`);
	if (users.length)
		await directus(
			'DELETE',
			'/users',
			users.map((u) => u.id),
		);

	for (const { id: policy } of await db('directus_policies').select('id').where('name', 'like', `${seeded.tag}%`)) {
		await directus('DELETE', `/policies/${policy}`);
	}

	await db.destroy();
}
