// Requests the reverse proxy forwarded, with the upstream that answered (log_format `upstream` of nginx.conf).
import { execFileSync } from 'node:child_process';

export interface ProxyEntry {
	method: string;
	path: string;
	status: number;
	upstream: string;
}

const LINE = /^\S+ "(\w+) (\S+) [^"]*" (\d+) (\S+)$/;

export function proxyLog(since?: string): ProxyEntry[] {
	const args = ['logs', ...(since ? ['--since', since] : []), 'parity-postgres-proxy-1'];
	const out = execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

	return out
		.split('\n')
		.map((line) => LINE.exec(line.trim()))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => ({ method: m[1]!, path: m[2]!, status: Number(m[3]), upstream: m[4]! }));
}

/** Host name of an upstream address as Docker DNS resolves the two services. */
export function upstreamOf(entry: ProxyEntry, addresses: { directus: string; backoffice: string }): string {
	const ip = entry.upstream.split(':')[0];
	if (ip === addresses.directus) return 'directus';
	if (ip === addresses.backoffice) return 'backoffice';
	return entry.upstream;
}

export function containerAddress(container: string): string {
	return execFileSync(
		'docker',
		['inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', container],
		{ encoding: 'utf8' },
	).trim();
}
