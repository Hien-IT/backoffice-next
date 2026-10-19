// Raw TUS requests shared by the 007 TUS parity file and the 019 deploy suite (moved from files/tus.test.ts).
import http from 'node:http';

export const b64 = (value: string) => Buffer.from(value).toString('base64');
export const metadata = (values: Record<string, string>) =>
	Object.entries(values)
		.map(([k, v]) => `${k} ${b64(v)}`)
		.join(',');

export interface TusResponse {
	status: number;
	headers: Record<string, string>;
	body: string;
}

/** A raw TUS request (node:http: HEAD and PATCH bodies the way tus-js-client sends them). */
export function tus(base: string, method: string, path: string, headers: Record<string, string>, body?: Buffer) {
	return new Promise<TusResponse>((resolve, reject) => {
		const req = http.request(
			new URL(path, base),
			{
				method,
				headers: { 'tus-resumable': '1.0.0', ...headers, ...(body ? { 'content-length': String(body.length) } : {}) },
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c: Buffer) => chunks.push(c));
				res.on('end', () =>
					resolve({
						status: res.statusCode ?? 0,
						headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, String(v)])),
						body: Buffer.concat(chunks).toString('utf8'),
					}),
				);
			},
		);

		req.on('error', reject);
		if (body) req.write(body);
		req.end();
	});
}
