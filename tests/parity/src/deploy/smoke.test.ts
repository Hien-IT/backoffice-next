// Feature 019, T014 (FR-040, FR-043): the default environment (spec 026: Directus and Backoffice on two domains) is up
// with every instance.
import { describe, expect, it } from 'vitest';
import { BO_PUBLIC_URL, boLbUrl, compose, instanceUrls, REPLICAS } from './instances.js';

describe('deploy compose smoke', () => {
	it('runs the requested number of BE replicas', () => {
		const running = compose('ps', '--format', '{{.Service}}', 'backoffice-api').trim().split('\n');
		expect(running).toHaveLength(REPLICAS);
	});

	it('answers on every instance and through the load balancer', async () => {
		for (const url of instanceUrls()) expect(await (await fetch(`${url}/server/ping`)).text()).toBe('pong');
		expect((await fetch(`${boLbUrl}/server/health`)).status).toBe(200);
		expect(await (await fetch(`${boLbUrl}/admin/config.json`)).json()).toEqual({ apiUrl: BO_PUBLIC_URL });
	});
});
