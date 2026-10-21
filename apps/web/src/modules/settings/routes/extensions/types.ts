// Ported from directus/app/src/modules/settings/routes/extensions/types.ts
import type { ExtensionType as ExtensionTypeOriginal } from '@directus/types';

export type ExtensionState = 'enabled' | 'disabled' | 'partial';

export type ExtensionType = ExtensionTypeOriginal | 'missing';
