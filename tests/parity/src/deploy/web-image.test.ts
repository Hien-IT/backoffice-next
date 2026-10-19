// Feature 019, US8 (FR-001..FR-006, contracts/images.md): one FE image for every environment, serving /admin like
// Directus 11.17.4 (cache headers, SPA fallback) with the same Content-Security-Policy for the same env.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { docker, runContainer, runDirectus, SEPARATE, waitFor, WEB_IMAGE } from './instances.js';

const q = "'";
// The env sets of the comparison (research R2, T022): defaults, a longer list, no helmet defaults, a new directive.
const CSP_ENVS: Record<string, string[]> = {
	defaults: [],
	scriptSrc: [`CONTENT_SECURITY_POLICY_DIRECTIVES__SCRIPT_SRC=array:${q}self${q},${q}unsafe-eval${q},https://cdn.test`],
	noDefaults: [
		'CONTENT_SECURITY_POLICY_USE_DEFAULTS=false',
		`CONTENT_SECURITY_POLICY_DIRECTIVES__DEFAULT_SRC=${q}self${q}`,
	],
	lists: [
		'CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC=https://a.test,https://b.test',
		`CONTENT_SECURITY_POLICY_DIRECTIVES__IMG_SRC=array:${q}self${q},data:`,
	],
};

const containers: string[] = [];
const fe: Record<string, string> = {};
const directus: Record<string, string> = {};

const start = (run: () => { id: string; url: string }) => {
	const c = run();
	containers.push(c.id);
	return c.url;
};

const head = async (url: string) => {
	const res = await fetch(url, { redirect: 'manual' });
	return { status: res.status, headers: res.headers, body: await res.text() };
};

describe.skipIf(SEPARATE)('FE image', () => {
	beforeAll(async () => {
		fe['a'] = start(() => runContainer(WEB_IMAGE, ['PUBLIC_URL=http://a.test'], 8080));
		fe['b'] = start(() => runContainer(WEB_IMAGE, ['PUBLIC_URL=http://b.test'], 8080));
		for (const [name, env] of Object.entries(CSP_ENVS)) {
			fe[name] = start(() => runContainer(WEB_IMAGE, env, 8080));
			directus[name] = start(() => runDirectus(env));
		}
		await Promise.all([
			...Object.values(fe).map((url) => waitFor(`${url}/admin/config.json`)),
			...Object.values(directus).map((url) => waitFor(`${url}/server/ping`)),
		]);
	}, 600_000);

	afterAll(() => {
		if (containers.length) docker('rm', '-f', ...containers);
	});

	it('writes the API URL of each environment into config.json, never cached', async () => {
		for (const name of ['a', 'b']) {
			const res = await fetch(`${fe[name]}/admin/config.json`);
			expect(await res.json()).toEqual({ apiUrl: `http://${name}.test` });
			expect(res.headers.get('cache-control')).toBe('no-store');
		}
	});

	it('serves the page at /admin, /admin/ and every unknown /admin path, never cached', async () => {
		for (const path of ['/admin', '/admin/', '/admin/content/x', '/admin/missing.js']) {
			const res = await head(`${fe['a']}${path}`);
			expect(res.status, path).toBe(200);
			expect(res.body, path).toContain('<div id="app"');
			expect(res.headers.get('cache-control'), path).toBe('no-cache');
			expect(res.headers.get('vary'), path).toBe('Origin, Cache-Control');
		}
	});

	it('caches the built files for a year', async () => {
		const page = await head(`${fe['a']}/admin/`);
		const asset = /\/admin\/assets\/[^"]+\.js/.exec(page.body)![0];
		const res = await head(`${fe['a']}${asset}`);
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('max-age=31536000, immutable');
		expect(res.headers.get('vary')).toBe('Origin, Cache-Control');
	});

	it('redirects / to /admin/', async () => {
		const res = await head(`${fe['a']}/`);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('/admin/');
	});

	it.each(Object.keys(CSP_ENVS))('sends the CSP Directus sends for /admin (%s)', async (name) => {
		const [ours, theirs] = await Promise.all([head(`${fe[name]}/admin`), head(`${directus[name]}/admin`)]);
		expect(theirs.headers.get('content-security-policy')).toBeTruthy();
		expect(ours.headers.get('content-security-policy')).toBe(theirs.headers.get('content-security-policy'));
	});

	it('runs as uid/gid 1001 (FR-025)', () => {
		expect(docker('exec', containers[0]!, 'id', '-u')).toBe('1001');
		expect(docker('exec', containers[0]!, 'id', '-g')).toBe('1001');
		expect(docker('exec', containers[0]!, 'sh', '-c', 'ps -o user,comm | grep nginx | sort -u')).not.toMatch(/root/);
	});

	it('carries the version labels', () => {
		const labels = JSON.parse(docker('image', 'inspect', WEB_IMAGE, '--format', '{{json .Config.Labels}}'));
		expect(labels['org.opencontainers.image.version']).toBeTruthy();
		// The labels inherited from the nginx base image are emptied (FR-022).
		for (const key of ['source', 'url', 'description', 'created', 'licenses'])
			expect(labels[`org.opencontainers.image.${key}`], key).toBe('');
		expect(labels['maintainer']).toBe('');
		expect(labels['org.opencontainers.image.revision']).toMatch(/^[0-9a-f]{40}$/);
	});
});
