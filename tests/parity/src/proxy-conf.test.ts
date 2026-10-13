// Feature 004 (T073): the nginx configuration of the reverse proxy is generated from the route list.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
// @ts-expect-error plain ESM script without types
import { buildNginxConf, parseRoutes } from '../scripts/proxy-conf.mjs';

describe('proxy-conf', () => {
	test('the list of features 004 to 009: twenty-two routes, comments and blank lines ignored', () => {
		const routes = parseRoutes(readFileSync(new URL('../proxy/backoffice-routes.txt', import.meta.url), 'utf8'));
		expect(routes).toEqual([
			'auth',
			'server',
			'metrics',
			'users',
			'roles',
			'policies',
			'access',
			'permissions',
			'items',
			'collections',
			'fields',
			'relations',
			'schema',
			'files',
			'folders',
			'assets',
			'activity',
			'revisions',
			'versions',
			'comments',
			'flows',
			'operations',
			'settings',
		]);
	});

	test('feature 005: /items and every path under it go to the new app', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['items']);
		const location = conf.match(/location ~ (\S+) \{/)![1]!;

		for (const path of ['/items', '/items/', '/items/articles', '/items/articles/1?export=csv'])
			expect(new RegExp(location).test(path.split('?')[0]!), path).toBe(true);
		expect(new RegExp(location).test('/itemsx')).toBe(false);
	});

	test('feature 006: the data model routes go to the new app, /utils/sort stays on Directus', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['collections', 'fields', 'relations', 'schema']);
		const location = conf.match(/location ~ (\S+) \{/)![1]!;

		for (const path of ['/collections', '/fields/articles', '/relations/articles/author', '/schema/snapshot'])
			expect(new RegExp(location).test(path), path).toBe(true);
		for (const path of ['/utils/sort/articles', '/schemas', '/fieldsx'])
			expect(new RegExp(location).test(path), path).toBe(false);
	});

	test('feature 007: files, folders, assets and TUS go to the new app, /utils stays on Directus', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['files', 'folders', 'assets']);
		const location = conf.match(/location ~ (\S+) \{/)![1]!;

		for (const path of ['/files', '/files/import', '/files/tus/abc', '/folders/x', '/assets/x', '/assets/x/photo.jpg'])
			expect(new RegExp(location).test(path), path).toBe(true);
		for (const path of ['/utils/sort/files', '/filesx', '/asset'])
			expect(new RegExp(location).test(path), path).toBe(false);
	});

	test('feature 008: history routes go to the new app, /utils/revert and /notifications stay on Directus', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['activity', 'revisions', 'versions', 'comments']);
		const location = conf.match(/location ~ (\S+) \{/)![1]!;

		for (const path of [
			'/activity',
			'/activity/1',
			'/revisions',
			'/versions/x/compare',
			'/versions/x/promote',
			'/comments/x',
		])
			expect(new RegExp(location).test(path), path).toBe(true);
		for (const path of ['/utils/revert/1', '/notifications', '/versionsx', '/comment'])
			expect(new RegExp(location).test(path), path).toBe(false);
	});

	test('feature 009: /flows and its trigger routes go to the new app, /settings stays on Directus', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['flows']);
		const location = conf.match(/location ~ (\S+) \{/)![1]!;

		for (const path of ['/flows', '/flows/x', '/flows/trigger/3f1c2d4e-0000-4000-8000-00000000000a'])
			expect(new RegExp(location).test(path), path).toBe(true);
		for (const path of ['/settings', '/flowsx', '/operations/x'])
			expect(new RegExp(location).test(path), path).toBe(false);

		const both = buildNginxConf(template, ['flows', 'operations']).match(/location ~ (\S+) \{/)![1]!;
		expect(new RegExp(both).test('/operations/x')).toBe(true);
	});

	test('one location for the routes of the new app, the rest to Directus', () => {
		const template = readFileSync(new URL('../proxy/nginx.conf.template', import.meta.url), 'utf8');
		const conf = buildNginxConf(template, ['auth', 'users']);

		expect(conf).toContain('location ~ ^/(auth|users)(/|$) {\n\t\tproxy_pass http://backoffice-api:8055;');
		expect(conf).toContain('location / {\n\t\tproxy_pass http://directus:8055;');
		expect(conf).toContain('$upstream_addr');
	});

	test('rejects an empty list and names that are not a path segment', () => {
		expect(() => buildNginxConf('{{ROUTES}}', [])).toThrow('empty');
		expect(() => parseRoutes('users\nitems/*')).toThrow('invalid route name');
	});
});
