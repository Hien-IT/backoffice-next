// Ported from directus/packages/env/src/utils/read-configuration-from-process.ts
/**
 * Returns the raw variables from the process
 */
export const readConfigurationFromProcess = () => {
	return { ...process.env } as Record<string, any>;
};
