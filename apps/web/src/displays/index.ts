// Ported from directus/app/src/displays/index.ts
import { sortBy } from 'lodash-es';
import type { DisplayConfig } from './types.ts';

// Backoffice: configs are looked up by id instead of being registered as global components (research R2).
export function sortDisplays(displays: DisplayConfig[]): DisplayConfig[] {
	return sortBy(displays, 'id');
}

const displays = sortDisplays(
	Object.values(import.meta.glob<DisplayConfig>('./*/index.ts', { import: 'default', eager: true })),
);

export function getDisplays(): DisplayConfig[] {
	return displays;
}

export function getDisplay(id: string | null | undefined): DisplayConfig | undefined {
	return displays.find((display) => display.id === id);
}
