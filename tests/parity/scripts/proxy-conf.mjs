// Feature 004 (FR-106, contracts/proxy-e2e.md §2): writes proxy/nginx.conf from proxy/nginx.conf.template and the
// list of routes the new app serves (proxy/backoffice-routes.txt). Run by env.mjs before `up`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Route names of the list: one per line, `#` comments and blank lines ignored. */
export function parseRoutes(text) {
	const routes = text
		.split('\n')
		.map((line) => line.replace(/#.*/, '').trim())
		.filter(Boolean);

	for (const route of routes) {
		if (!/^[a-z][a-z0-9-]*$/.test(route)) throw new Error(`invalid route name "${route}"`);
	}

	return routes;
}

export function buildNginxConf(template, routes) {
	if (routes.length === 0) throw new Error('the route list is empty');
	return template.replace('{{ROUTES}}', routes.join('|'));
}

export function writeNginxConf(dir = fileURLToPath(new URL('../proxy/', import.meta.url))) {
	const routes = parseRoutes(readFileSync(`${dir}backoffice-routes.txt`, 'utf8'));
	writeFileSync(`${dir}nginx.conf`, buildNginxConf(readFileSync(`${dir}nginx.conf.template`, 'utf8'), routes));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeNginxConf();
