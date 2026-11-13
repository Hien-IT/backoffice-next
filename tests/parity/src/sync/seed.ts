// Spec 032 (contracts/tests.md §2b): config written at the source (main Backoffice) and at the target (profile sync)
// through their REST APIs, one set per run with fresh ids, removed again by cleanup().
import { source, target, uuid } from './helpers.js';

export interface Seed {
	run: string;
	collection: string;
	flow: string;
	operation: string;
	policy: string;
	role: string;
	link: string;
	translationKey: string;
	bookmark: string;
	dashboard: string;
	panel: string;
	folder: string;
	targetFlow: string;
}

export function newSeed(): Seed {
	const run = uuid().slice(0, 8);

	return {
		run,
		collection: `parity_sync_${run}`,
		flow: uuid(),
		operation: uuid(),
		policy: uuid(),
		role: uuid(),
		link: uuid(),
		translationKey: `parity_sync_${run}`,
		bookmark: `Parity sync ${run}`,
		dashboard: uuid(),
		panel: uuid(),
		folder: uuid(),
		targetFlow: uuid(),
	};
}

export const collectionBody = (collection: string) => ({
	collection,
	meta: { icon: 'sync' },
	schema: {},
	fields: [
		{
			field: 'id',
			type: 'integer',
			meta: { hidden: true },
			schema: { is_primary_key: true, has_auto_increment: true },
		},
		{ field: 'title', type: 'string', meta: { interface: 'input' }, schema: {} },
	],
});

export const flowBody = (id: string, name: string) => ({
	id,
	name,
	icon: 'bolt',
	status: 'active',
	trigger: 'webhook',
	accountability: 'all',
	options: { method: 'GET', async: false },
});

/** Everything of FR-007 except settings and extensions, at the source; at the target a flow of its own and the same policy
 * under another name (a "changed" row). */
export async function seed(s: Seed): Promise<void> {
	await source('POST', '/collections', collectionBody(s.collection));
	await source('POST', '/flows', flowBody(s.flow, `Parity sync flow ${s.run}`));
	await source('POST', '/operations', {
		id: s.operation,
		flow: s.flow,
		key: 'log_it',
		name: 'Log',
		type: 'log',
		position_x: 19,
		position_y: 1,
		options: { message: `parity sync ${s.run}` },
	});
	await source('PATCH', `/flows/${s.flow}`, { operation: s.operation });
	await source('POST', '/policies', {
		id: s.policy,
		name: `Parity sync policy ${s.run}`,
		icon: 'badge',
		app_access: true,
	});
	await source('POST', '/permissions', {
		policy: s.policy,
		collection: s.collection,
		action: 'read',
		fields: ['*'],
		permissions: {},
		validation: {},
	});
	await source('POST', '/roles', { id: s.role, name: `Parity sync role ${s.run}`, icon: 'group' });
	await source('POST', '/access', { id: s.link, role: s.role, policy: s.policy });
	await source('POST', '/translations', { language: 'en-US', key: s.translationKey, value: 'Parity sync' });
	await source('POST', '/presets', { collection: s.collection, bookmark: s.bookmark, layout: 'tabular' });
	await source('POST', '/dashboards', {
		id: s.dashboard,
		name: `Parity sync dashboard ${s.run}`,
		icon: 'space_dashboard',
	});
	await source('POST', '/panels', {
		id: s.panel,
		dashboard: s.dashboard,
		type: 'label',
		position_x: 1,
		position_y: 1,
		width: 6,
		height: 6,
		options: { text: 'Parity sync' },
	});
	await source('POST', '/folders', { id: s.folder, name: `Parity sync folder ${s.run}` });

	await expectOk(target('POST', '/flows', flowBody(s.targetFlow, `Parity target flow ${s.run}`)));
	await expectOk(target('POST', '/policies', { id: s.policy, name: `Parity target policy ${s.run}`, icon: 'badge' }));
}

async function expectOk(answer: Promise<{ status: number; body: unknown }>) {
	const { status, body } = await answer;
	if (status >= 400) throw new Error(`target seed failed: ${status} ${JSON.stringify(body)}`);
}

const quiet = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch {
		// already gone
	}
};

/** Removes the seed (and whatever an apply copied) at both sides; missing rows are fine. */
export async function cleanup(s: Seed): Promise<void> {
	const del = async (path: string) => {
		await quiet(source('DELETE', path));
		await target('DELETE', path);
	};

	await del(`/flows/${s.flow}`);
	await del(`/flows/${s.targetFlow}`);
	await del(`/dashboards/${s.dashboard}`);
	await del(`/folders/${s.folder}`);
	await del(`/access/${s.link}`);
	await del(`/roles/${s.role}`);
	await del(`/policies/${s.policy}`);

	for (const side of [source, (m: string, p: string) => target(m, p).then((a) => a.body)] as const) {
		const translations = await quiet2(side('GET', `/translations?filter[key][_eq]=${s.translationKey}&fields=id`));
		for (const t of translations?.data ?? []) await quiet(side('DELETE', `/translations/${t.id}`));
		const presets = await quiet2(side('GET', `/presets?filter[collection][_eq]=${s.collection}&fields=id`));
		for (const p of presets?.data ?? []) await quiet(side('DELETE', `/presets/${p.id}`));
	}

	await del(`/collections/${s.collection}`);
}

async function quiet2(promise: Promise<any>): Promise<any> {
	try {
		return await promise;
	} catch {
		return undefined;
	}
}
