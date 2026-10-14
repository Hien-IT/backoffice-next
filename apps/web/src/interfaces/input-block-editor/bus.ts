// Ported from directus/app/src/interfaces/input-block-editor/bus.ts
import { useEventBus } from '@vueuse/core';

type Event = {
	type: 'open-url';
	payload: string;
};

export function useBus() {
	const bus = useEventBus<Event>('editorjs');

	return bus;
}
