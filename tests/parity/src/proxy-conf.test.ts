// Feature 004 (T073): the nginx configuration of the reverse proxy is generated from the route list.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
// @ts-expect-error plain ESM script without types
import { buildNginxConf, parseRoutes } from '../scripts/proxy-conf.mjs';

describe('proxy-conf', () => {
	test('the list of feature 004: eight routes, comments and blank lines ignored', () => {
		const routes = parseRoutes(readFileSync(new URL('../proxy/backoffice-routes.txt', import.meta.url), 'utf8'));
		expect(routes).toEqual(['auth', 'server', 'metrics', 'users', 'roles', 'policies', 'access', 'permissions']);
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
