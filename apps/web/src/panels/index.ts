// Ported from directus/app/src/panels/index.ts
import { sortBy } from 'lodash-es';
import type { PanelConfig } from './types.ts';

// Backoffice: the 11 built-in panels only (no extensions, principle XI); configs are looked up by id instead of being
// registered as global `panel-<id>` components, like the operations registry of feature 017.
const panels = sortBy(
	Object.values(import.meta.glob<PanelConfig>('./*/index.ts', { import: 'default', eager: true })),
	'id',
);

export function getPanels(): PanelConfig[] {
	return panels;
}

export function getPanel(id: string | null | undefined): PanelConfig | undefined {
	return panels.find((panel) => panel.id === id);
}
