// Ported from directus/packages/env/src/index.ts
export { useEnv } from './lib/use-env.js';

// Backoffice: raw-configuration helpers for the startup warnings of apps/api (FR-014).
export { DIRECTUS_VARIABLES } from './constants/directus-variables.js';
export { DEFAULTS } from './constants/defaults.js';
export { cast } from './lib/cast.js';
export { readConfigurationFromFile } from './lib/read-configuration-from-file.js';
export { getConfigPath } from './utils/get-config-path.js';
export { isDirectusVariable } from './utils/is-directus-variable.js';
export { isFileKey } from './utils/is-file-key.js';
export { readConfigurationFromProcess } from './utils/read-configuration-from-process.js';
export { removeFileSuffix } from './utils/remove-file-suffix.js';
