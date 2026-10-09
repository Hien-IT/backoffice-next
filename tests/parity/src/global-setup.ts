import { awaitDirectusConnection } from './await-connection.js';
import { appPorts, type Profile, profilePorts } from './config.js';
import { getDbsToTest } from './get-dbs-to-test.js';
import { profileEnvKeys } from './profiles.js';

async function answers(url: string): Promise<boolean> {
	try {
		const res = await fetch(new URL('/server/ping', url), { signal: AbortSignal.timeout(2000) });
		return res.status === 200 || res.status === 503;
	} catch {
		return false;
	}
}

/** Sets the URLs of both apps and of each profile pair that is running, and waits until the main pair answers. */
export default async function setup(): Promise<void> {
	const [vendor] = getDbsToTest();
	process.env['TEST_DB'] = vendor;
	process.env['PARITY_SUITE'] ??= 'full';
	process.env['DIRECTUS_URL'] ??= `http://127.0.0.1:${appPorts.directus}`;
	process.env['BACKOFFICE_URL'] ??= `http://127.0.0.1:${appPorts.backoffice}`;

	await awaitDirectusConnection(process.env['DIRECTUS_URL'], 60, 2000);
	await awaitDirectusConnection(process.env['BACKOFFICE_URL'], 60, 2000);

	for (const [profile, ports] of Object.entries(profilePorts) as [
		Profile,
		{ directus: number; backoffice: number },
	][]) {
		const [directusKey, backofficeKey] = profileEnvKeys(profile);
		const directus = `http://127.0.0.1:${ports.directus}`;
		const backoffice = `http://127.0.0.1:${ports.backoffice}`;

		if ((await answers(directus)) && (await answers(backoffice))) {
			process.env[directusKey] ??= directus;
			process.env[backofficeKey] ??= backoffice;
		}
	}
}
