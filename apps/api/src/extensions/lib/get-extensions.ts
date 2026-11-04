// Ported from directus/api/src/extensions/lib/get-extensions.ts
import { join } from 'node:path';
import { useEnv } from '@backoffice/env';
import { resolveFsExtensions, resolveModuleExtensions } from '@backoffice/extensions/node';
import { getExtensionsPath } from './get-extensions-path.js';

export const getExtensions = async () => {
	const env = useEnv();

	const localExtensions = await resolveFsExtensions(getExtensionsPath());
	const registryExtensions = await resolveFsExtensions(join(getExtensionsPath(), '.registry'));
	// Backoffice (spec 031, D-212): uploaded packages live in the hidden .upload folder, which DR never scans.
	const uploadExtensions = await resolveFsExtensions(join(getExtensionsPath(), '.upload'));

	/** Extensions that are listed as dependencies in the root package.json */
	const moduleExtensions = await resolveModuleExtensions(env['PACKAGE_FILE_LOCATION'] as string);

	return { local: localExtensions, registry: registryExtensions, module: moduleExtensions, upload: uploadExtensions };
};
