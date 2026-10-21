// Test extensions registry for the parity env (specs/010-system-collections research R12, contracts/parity.md §4).
// Both apps point MARKETPLACE_REGISTRY here, so the registry browse routes of /extensions answer the same fixed data
// without the real registry. It is also the COMPLIANCE_URL of the env: Directus sends the owner report of
// POST /settings/owner and /server/setup here instead of telemetry.directus.io; GET /v1/owner counts the reports, so
// the parity files check that Backoffice sends none (D-38). Only node:http and node:fs, so the `node:22-alpine` image
// runs it without a build. The fixtures follow the zod schemas of @directus/extensions-registry
// (apps/api/src/extensions/registry/fixtures.test.ts).
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

/** The registry API version Directus 11.17.4 accepts (packages/extensions-registry/src/constants.ts). */
export const REGISTRY_VERSION = '2024-01-29';

const FIXTURES_DIR = process.env.FIXTURES_DIR ?? '/fixtures';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

function send(res, status, body) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(body));
}

/**
 * GET /extensions: the query of constructUrl (search, type, by, sort, limit, offset, sandbox). `by` is an account id
 * (the account page of the app) or a username; list rows carry the publisher's username only.
 */
export function listExtensions(all, params, accounts = {}) {
	let data = [...all];
	const search = params.get('search');
	const type = params.get('type');
	const by = accounts[params.get('by')]?.data.username ?? params.get('by');

	if (search) data = data.filter((e) => e.name.includes(search) || (e.description ?? '').includes(search));
	if (type) data = data.filter((e) => e.type === type);
	if (by) data = data.filter((e) => e.publisher.username === by);
	if (params.get('sandbox') === 'true') data = data.filter((e) => e.sandbox);

	const sort = params.get('sort');
	if (sort === 'popular' || sort === 'downloads') data.sort((a, b) => b.total_downloads - a.total_downloads);
	if (sort === 'recent') data.sort((a, b) => b.last_updated.localeCompare(a.last_updated));

	const filterCount = data.length;
	const offset = Number(params.get('offset') ?? 0);
	const limit = Number(params.get('limit') ?? 5);

	return { meta: { filter_count: filterCount }, data: data.slice(offset, offset + limit) };
}

export function createRegistryServer() {
	const list = load('list');
	const describe = load('describe');
	const accounts = load('accounts');

	const owner = { count: 0, last: null };

	return createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://registry');

		if (url.pathname === '/v1/owner' && req.method === 'POST') {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', () => {
				owner.count++;
				owner.last = JSON.parse(body || 'null');
				send(res, 200, {});
			});
			return;
		}

		if (url.pathname === '/v1/owner' && req.method === 'GET') return send(res, 200, owner);
		if (req.method !== 'GET') return send(res, 404, { error: 'not found' });
		if (url.pathname === '/version') return send(res, 200, { version: REGISTRY_VERSION });
		if (url.pathname === '/extensions') return send(res, 200, listExtensions(list, url.searchParams, accounts));

		const extension = /^\/extensions\/([^/]+)$/.exec(url.pathname);
		if (extension)
			return describe[extension[1]] ? send(res, 200, describe[extension[1]]) : send(res, 404, { error: 'not found' });

		// Spec 020 (T171): the packed fixture extension of a version (`npm pack` of tests/fixtures/extensions, mounted at
		// FIXTURES_DIR); 404 with `sandbox=true` for an extension that is not sandboxed, as the real registry.
		const download = /^\/download\/([^/]+)$/.exec(url.pathname);
		if (download) {
			const found = Object.values(describe).find(({ data }) => data.versions.some((v) => v.id === download[1]));
			const version = found?.data.versions.find((v) => v.id === download[1]);
			const sandboxed = list.find((e) => e.id === found?.data.id)?.sandbox === true;
			const file = found && `${FIXTURES_DIR}/${found.data.name}/${found.data.name}-${version.version}.tgz`;
			if (!file || !existsSync(file) || (url.searchParams.get('sandbox') === 'true' && !sandboxed))
				return send(res, 404, { error: 'not found' });
			res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
			return res.end(readFileSync(file));
		}

		const account = /^\/accounts\/([^/]+)$/.exec(url.pathname);
		if (account)
			return accounts[account[1]] ? send(res, 200, accounts[account[1]]) : send(res, 404, { error: 'not found' });

		return send(res, 404, { error: 'not found' });
	});
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const port = Number(process.env.PORT ?? 9100);
	createRegistryServer().listen(port, () => process.stdout.write(`Test registry listening on ${port}\n`));
}
