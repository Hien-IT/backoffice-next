// Ported from directus/app/src/panels/index.ts
import { sortBy } from 'lodash-es';
import type { PanelConfig } from './types.ts';

// Backoffice: the 11 built-in panels and those of app extensions (spec 020); configs are looked up by id instead of being
// registered as global `panel-<id>` components, like the operations registry of feature 017.
const internal = sortBy(
	Object.values(import.meta.glob<PanelConfig>('./*/index.ts', { import: 'default', eager: true })),
	'id',
);

let panels = internal;

export function getInternalPanels(): PanelConfig[] {
	return [...internal];
}

/** Spec 020 (FR-064): the internal panels and those of app extensions. */
export function registerPanels(list: PanelConfig[]): void {
	panels = sortBy(list, 'id');
}

export function getPanels(): PanelConfig[] {
	return panels;
}

export function getPanel(id: string | null | undefined): PanelConfig | undefined {
	return panels.find((panel) => panel.id === id);
}
