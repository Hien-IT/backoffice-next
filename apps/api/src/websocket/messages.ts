// Ported from directus/api/src/websocket/messages.ts (only the WebSocketEvent message, as a plain type)
// Backoffice: DR validates WebSocket client messages with zod schemas; no WebSocket is opened here (Principle XI,
// spec FR-033), so only the shape of the bus message that hooks.ts publishes is kept, without zod.
export type WebSocketEvent =
	| { action: 'create'; collection: string; payload?: Record<string, any>; key: string | number }
	| { action: 'update'; collection: string; payload?: Record<string, any>; keys: (string | number)[] }
	| { action: 'delete'; collection: string; payload?: Record<string, any>; keys: (string | number)[] };
