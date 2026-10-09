// Ported from directus/packages/system-data/src/app-access-permissions/index.ts
import { loadYaml } from '../load-yaml.js';
import type { DataPermission, Permission } from '../types.js';
const permissions = loadYaml(new URL('./app-access-permissions.yaml', import.meta.url));
const schemaPermissionsRaw = loadYaml(new URL('./schema-access-permissions.yaml', import.meta.url));

const defaults: Partial<Permission> = {
	policy: null,
	permissions: {},
	validation: null,
	presets: null,
	fields: ['*'],
	system: true,
};

export const schemaPermissions: Permission[] = (schemaPermissionsRaw as unknown as DataPermission[]).map(
	(row) => ({ ...defaults, ...row }) as Permission,
);

export const appAccessMinimalPermissions: Permission[] = [
	...schemaPermissions,
	...(permissions as unknown as DataPermission[]),
].map((row) => ({ ...defaults, ...row }) as Permission);
