// Ported from directus/app/src/composables/use-layout-click-handler.ts
import type { Field, Item, PrimaryKey } from '@directus/types';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { getItemRoute } from '../utils/get-item-route.ts';

export type UseLayoutClickHandlerOptions = {
	// Backoffice: Pick<LayoutProps, 'selectMode' | 'readonly' | 'collection'> of @directus/extensions (not a dependency).
	props: { selectMode: boolean; readonly: boolean; collection: string | null };
	selection: Ref<PrimaryKey[]>;
	primaryKeyField: Readonly<Ref<Field | null>>;
};

export function useLayoutClickHandler({ props, selection, primaryKeyField }: UseLayoutClickHandlerOptions) {
	const router = useRouter();

	return {
		onClick,
	};

	// Backoffice: Item of @directus/types instead of components/v-table/types (same shape, Record<string, any>).
	function onClick({ item, event }: { item: Item; event: MouseEvent }) {
		if (props.readonly === true || !primaryKeyField.value) return;

		const primaryKey = item[primaryKeyField.value.field];

		if (props.selectMode || selection.value?.length > 0) {
			if (selection.value?.includes(primaryKey) === false) {
				selection.value = selection.value.concat(primaryKey);
			} else {
				selection.value = selection.value.filter((item) => item !== primaryKey);
			}
		} else {
			const route = getItemRoute(props.collection, primaryKey);

			if (event.ctrlKey || event.metaKey) window.open(router.resolve(route).href, '_blank');
			else router.push(route);
		}
	}
}
