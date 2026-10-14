// Ported from directus/app/src/events.ts
import mitt from 'mitt';

export const emitter = mitt();

// Backoffice: upload events belong to the Files module (feature 015); sessionExpired replaces the 401 handling
// of the Directus axios client (FR-001).
export enum Events {
	tabIdle = 'tab-idle',
	tabActive = 'tab-active',
	sessionExpired = 'session-expired',
}
