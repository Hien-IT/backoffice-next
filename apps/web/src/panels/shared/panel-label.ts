import type { InjectionKey, Ref } from 'vue';

/** The accessible label of the dashboard tile (panel name or type name), provided by PanelTile (FR-106). */
export const PANEL_LABEL: InjectionKey<Ref<string>> = Symbol('panel-label');
