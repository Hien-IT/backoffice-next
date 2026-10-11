// Ported from directus/tests/blackbox/common/types.ts
// Backoffice: only the types the item tests use; the WebSocket types (graphql-ws, ws) are left out with the WebSocket
// assertions (Principle XI, D-17).
export type PrimaryKeyType = 'integer' | 'uuid' | 'string';
