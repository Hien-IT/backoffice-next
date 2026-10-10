// Feature 002, research R8: runs clearSystemCache() of the built API inside a running Backoffice container (same
// image and env), without HTTP. This is how the parity tests make "the new app changed the schema" until the
// schema endpoints exist (006) and POST /utils/cache/clear (010).
import { compose } from '../docker.js';

const SCRIPT = (opts: string) => `
const { clearSystemCache } = await import('/directus/dist/cache.js');
const { useRedis } = await import('/directus/dist/redis/index.js');
await clearSystemCache(${opts});
// PUBLISH schemaChanged is not awaited by clearSystemCache (like Directus): QUIT runs after the pending commands.
await useRedis().quit();
process.exit(0);
`;

export function clearSystemCacheIn(service: string, opts: { forced?: boolean; autoPurgeCache?: false } = {}): void {
	try {
		compose('exec', '-T', service, 'node', '--input-type=module', '-e', SCRIPT(JSON.stringify(opts)));
	} catch (error) {
		const stderr = (error as { stderr?: string }).stderr ?? '';
		throw new Error(`clearSystemCache in ${service} failed: ${stderr || (error as Error).message}`);
	}
}
