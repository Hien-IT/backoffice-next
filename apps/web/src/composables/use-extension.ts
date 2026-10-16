// Ported from directus/app/src/composables/use-extension.ts
// Backoffice: the interfaces and displays come from the apps/web registries (no extensions store); the other
// extension types do not exist in the app and give null.
import { computed, type Ref, unref } from 'vue';
import { getDisplay } from '../displays/index.ts';
import type { DisplayConfig } from '../displays/types.ts';
import { getInterface } from '../interfaces/index.ts';
import type { InterfaceConfig } from '../interfaces/types.ts';

type Configs = { interface: InterfaceConfig; display: DisplayConfig };

export function useExtension<T extends keyof Configs>(
	type: T | Ref<T>,
	name: string | Ref<string | null | undefined> | null | undefined,
): Ref<Configs[T] | null> {
	return computed(() => {
		const id = unref(name);
		if (!id) return null;
		return ((unref(type) === 'interface' ? getInterface(id) : getDisplay(id)) ?? null) as Configs[T] | null;
	});
}
