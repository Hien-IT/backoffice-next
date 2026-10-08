// Ported from directus/packages/utils/node/get-node-env.ts
/**
 * Get the configured Node Environment (eg "production", "development", etc)
 */
export const getNodeEnv = (): string | undefined => process.env['NODE_ENV'];
