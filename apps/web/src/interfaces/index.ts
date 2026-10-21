// Ported from directus/app/src/interfaces/index.ts
import { sortBy } from 'lodash-es';
import type { InterfaceConfig } from './types.ts';

// Backoffice: configs are looked up by id instead of being registered as global components (research R2).
export function sortInterfaces(interfaces: InterfaceConfig[]): InterfaceConfig[] {
	return sortBy(interfaces, 'id');
}

const internal = sortInterfaces(
	Object.values(
		import.meta.glob<InterfaceConfig>(['./*/index.ts', './_system/*/index.ts'], {
			import: 'default',
			eager: true,
		}),
	),
);

let interfaces = internal;

export function getInternalInterfaces(): InterfaceConfig[] {
	return [...internal];
}

/** Spec 020 (FR-064): the internal interfaces and those of app extensions, registered once before the app mounts. */
export function registerInterfaces(list: InterfaceConfig[]): void {
	interfaces = sortInterfaces(list);
}

export function getInterfaces(): InterfaceConfig[] {
	return interfaces;
}

export function getInterface(id: string | null | undefined): InterfaceConfig | undefined {
	return interfaces.find((inter) => inter.id === id);
}
