// Ported from directus/api/src/utils/get-allowed-log-levels.ts
// Backoffice: the logger is read on each call (no useLogger() at module level).
import { useLogger } from '../logger/index.js';

export const getAllowedLogLevels = (level: string) => {
	const logger = useLogger();
	const levelValue = logger.levels.values[level];

	if (levelValue === undefined) {
		throw new Error(`Invalid "${level}" log level`);
	}

	return Object.fromEntries(
		Object.entries(logger.levels.values)
			.filter(([_, value]) => value >= levelValue)
			.sort((a, b) => a[1] - b[1]),
	);
};
