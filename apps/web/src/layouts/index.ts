// Ported from directus/app/src/layouts/index.ts
// Backoffice: no global `layout-<id>` components; the screens render `getLayout(id).component` and its slots (research R4).
import { sortBy } from 'lodash-es';
import type { LayoutConfig } from './types.ts';

const modules = import.meta.glob<LayoutConfig>('./*/index.ts', { import: 'default', eager: true });

const layouts: LayoutConfig[] = sortBy(Object.values(modules), 'id');

export function getLayouts(): LayoutConfig[] {
	return layouts;
}

export function getLayout(id: string | null | undefined): LayoutConfig | undefined {
	return layouts.find((layout) => layout.id === id);
}
