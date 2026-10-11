// Backoffice: stand-in for directus/api/src/emitter.ts with the same API. Events are not emitted (D-29 of spec 004,
// research R8): extensions are out of scope (Principle XI) and flows come with feature 009, which replaces this file
// with the real port. Ported services keep every emitter call of Directus so they stay line-for-line comparable.
import type { EventContext } from '@backoffice/types';

export class Emitter {
	/** Directus runs the filter hooks registered for the events; none can be registered here, so the payload is kept. */
	public async emitFilter<T>(
		_event: string | string[],
		payload: T,
		_meta: Record<string, any>,
		_context: EventContext | null = null,
	): Promise<T> {
		return payload;
	}

	public emitAction(_event: string | string[], _meta: Record<string, any>, _context: EventContext | null = null): void {}

	public async emitInit(_event: string, _meta: Record<string, any>): Promise<void> {}
}

const emitter = new Emitter();

export const useEmitter = () => emitter;

export default emitter;
