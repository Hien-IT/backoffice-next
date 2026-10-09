// Ported from directus/api/src/extensions/lib/get-extensions-path.ts
import { join } from 'path';
import { useEnv } from '@backoffice/env';

export const getExtensionsPath = () => {
	const env = useEnv();

	if (env['EXTENSIONS_LOCATION']) {
		return join(env['TEMP_PATH'] as string, 'extensions');
	}

	return env['EXTENSIONS_PATH'] as string;
};
