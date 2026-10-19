// Feature 019, T014 (FR-040, FR-043): the shared-domain environment is up with every instance.
import { describe, expect, it } from 'vitest';
import { compose, instanceUrls, lbUrl, REPLICAS, SEPARATE } from './instances.js';

describe.skipIf(SEPARATE)('deploy compose smoke', () => {
	it('runs the requested number of BE replicas', () => {
		const running = compose('ps', '--format', '{{.Service}}', 'backoffice-api').trim().split('\n');
		expect(running).toHaveLength(REPLICAS);
	});

	it('answers on every instance and through the load balancer', async () => {
		for (const url of instanceUrls()) expect(await (await fetch(`${url}/server/ping`)).text()).toBe('pong');
		expect((await fetch(`${lbUrl}/server/health`)).status).toBe(200);
		expect(await (await fetch(`${lbUrl}/admin/config.json`)).json()).toEqual({ apiUrl: 'http://localhost:8090' });
	});
});
