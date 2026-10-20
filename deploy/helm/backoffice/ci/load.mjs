// Feature 019, CI only (T091): reads and writes through the Ingress for DURATION seconds; prints the autocannon totals
// as JSON. Usage: node load.mjs <base url> <host header> <token> <collection> [duration]
import { createRequire } from 'node:module';

const autocannon = createRequire(new URL('../../../../tests/parity/package.json', import.meta.url))('autocannon');
const [url, host, token, collection, duration = '60'] = process.argv.slice(2);
const result = await autocannon({
	url,
	connections: 10,
	duration: Number(duration),
	headers: { host, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
	requests: [
		{ method: 'GET', path: `/items/${collection}?limit=1` },
		{ method: 'POST', path: `/items/${collection}`, body: JSON.stringify({ title: 'load' }) },
	],
});
console.log(
	JSON.stringify({
		requests: result.requests.total,
		errors: result.errors,
		timeouts: result.timeouts,
		non2xx: result.non2xx,
		statusCodes: result.statusCodeStats,
	}),
);
