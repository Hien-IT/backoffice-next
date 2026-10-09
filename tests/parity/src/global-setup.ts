import { awaitDirectusConnection } from './await-connection.js';
import { appPorts } from './config.js';
import { getDbsToTest } from './get-dbs-to-test.js';

/** Sets the URLs of both apps (and of each enabled profile pair) and waits until they answer. */
export default async function setup(): Promise<void> {
	const [vendor] = getDbsToTest();
	process.env['TEST_DB'] = vendor;
	process.env['PARITY_SUITE'] ??= 'full';
	process.env['DIRECTUS_URL'] ??= `http://127.0.0.1:${appPorts.directus}`;
	process.env['BACKOFFICE_URL'] ??= `http://127.0.0.1:${appPorts.backoffice}`;

	await awaitDirectusConnection(process.env['DIRECTUS_URL'], 60, 2000);
	await awaitDirectusConnection(process.env['BACKOFFICE_URL'], 60, 2000);
}
