// Ported from directus/api/src/utils/validate-env.ts
import { useEnv } from '@backoffice/env';
import { useLogger } from '../logger/index.js';

export function validateEnv(requiredKeys: string[]): void {
	const env = useEnv();
	const logger = useLogger();

	for (const requiredKey of requiredKeys) {
		if (requiredKey in env === false) {
			logger.error(`"${requiredKey}" Environment Variable is missing.`);
			process.exit(1);
		}
	}
}
