// Ported from directus/packages/extensions-registry/src/index.ts and src/modules/index.ts
// Backoffice: no `download` module, the app does not install extensions (Principle XI, D-37).
export * from './modules/account/account.js';
export * from './modules/describe/describe.js';
export * from './modules/list/list.js';
