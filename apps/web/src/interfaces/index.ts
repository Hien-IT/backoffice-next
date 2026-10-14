// Ported from directus/app/src/interfaces/index.ts
import { sortBy } from 'lodash-es';
import type { InterfaceConfig } from './types.ts';

// Backoffice: configs are looked up by id instead of being registered as global components (research R2).
export function sortInterfaces(interfaces: InterfaceConfig[]): InterfaceConfig[] {
	return sortBy(interfaces, 'id');
}

const interfaces = sortInterfaces(
	Object.values(
		import.meta.glob<InterfaceConfig>(['./*/index.ts', './_system/*/index.ts'], {
			import: 'default',
			eager: true,
		}),
	),
);

export function getInterfaces(): InterfaceConfig[] {
	return interfaces;
}

export function getInterface(id: string | null | undefined): InterfaceConfig | undefined {
	return interfaces.find((inter) => inter.id === id);
}
