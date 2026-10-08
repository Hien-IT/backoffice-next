// Ported from directus/packages/env/src/utils/read-configuration-from-yaml.ts
import { requireYaml } from '@backoffice/utils/node';
import { isPlainObject } from 'lodash-es';

export const readConfigurationFromYaml = (path: string) => {
	const config = requireYaml(path);

	if (isPlainObject(config) === false) {
		throw new Error('YAML configuration file does not contain an object');
	}

	return config as Record<string, unknown>;
};
