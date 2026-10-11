// Ported from directus/api/src/permissions/utils/default-permission.ts
import type { Permission } from '@backoffice/types';

export const DEFUAULT_PERMISSION = {
	policy: null,
	permissions: null,
	validation: null,
	presets: null,
	fields: null,
} satisfies Partial<Permission>;
