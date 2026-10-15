// Ported from directus/app/src/layouts/cards/index.ts
// Backoffice: no `useAiToolsStore().onSystemToolResult` refresh (D-70, no AI tools); `useSync` of @directus/composables
// is a local writable computed (same get/emit); the layout components are async chunks because the registry imports
// every layout index.ts eagerly (bundle budget).
import { getFieldsFromTemplate } from '@directus/utils';
import { computed, defineAsyncComponent, ref, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCollection } from '../../composables/use-collection.ts';
import { useItems } from '../../composables/use-items.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { formatItemsCountPaginated } from '../../utils/format-items-count.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';
import { saveAsCSV } from '../../utils/save-as-csv.ts';
import { syncRefProperty } from '../../utils/sync-ref-property.ts';
import { defineLayout } from '../types.ts';
import type { LayoutContext, LayoutProps } from '../types.ts';
import type { LayoutOptions, LayoutQuery } from './types.ts';

function useSync<K extends 'selection' | 'layoutOptions' | 'layoutQuery'>(
	props: LayoutProps<LayoutOptions, LayoutQuery>,
	key: K,
	emit: LayoutContext['emit'],
) {
	return computed<LayoutProps<LayoutOptions, LayoutQuery>[K]>({
		get: () => props[key],
		set: (value) => emit(`update:${key}`, value),
	});
}

export default defineLayout<LayoutOptions, LayoutQuery>({
	id: 'cards',
	name: '$t:layouts.cards.cards',
	icon: 'grid_view',
	component: defineAsyncComponent(() => import('./Cards.vue')),
	headerShadow: false,
	slots: {
		options: defineAsyncComponent(() => import('./CardsOptions.vue')),
		sidebar: () => undefined,
		actions: defineAsyncComponent(() => import('./CardsActions.vue')),
	},
	setup(props, { emit }) {
		const { t, n } = useI18n();
		const relationsStore = useRelationsStore();

		const selection = useSync(props, 'selection', emit);
		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const layoutQuery = useSync(props, 'layoutQuery', emit);

		const { collection, filter, search, filterSystem, filterUser } = toRefs(props);

		const { info, primaryKeyField, fields: fieldsInCollection } = useCollection(collection);

		const fileFields = computed(() => {
			return fieldsInCollection.value.filter((field) => {
				if (field.field === '$thumbnail') return true;

				const relation = relationsStore.relations.find((relation) => {
					return (
						relation.collection === props.collection &&
						relation.field === field.field &&
						relation.related_collection === 'directus_files'
					);
				});

				return !!relation;
			});
		});

		const { size, icon, imageSource, title, subtitle, imageFit } = useLayoutOptions();
		const { sort, limit, page, fields } = useLayoutQuery();

		const {
			items,
			loading,
			loadingItemCount,
			error,
			totalPages,
			itemCount,
			totalCount,
			getItems,
			getTotalCount,
			getItemCount,
		} = useItems(collection, {
			sort,
			limit,
			page,
			fields,
			filter,
			search,
			filterSystem,
		});

		const showingCount = computed(() => {
			// Don't show count if there are no items
			if (!totalCount.value || !itemCount.value) return;

			return formatItemsCountPaginated({
				currentItems: itemCount.value,
				currentPage: page.value,
				perPage: limit.value,
				isFiltered: !!filterUser.value,
				totalItems: totalCount.value,
				i18n: { t, n },
			});
		});

		const width = ref(0);

		const isSingleRow = computed(() => {
			const cardsWidth = items.value.length * (size.value * 40) + (items.value.length - 1) * 24;
			return cardsWidth <= width.value;
		});

		return {
			items,
			loading,
			loadingItemCount,
			error,
			totalPages,
			page,
			toPage,
			itemCount,
			totalCount,
			fieldsInCollection,
			limit,
			size,
			primaryKeyField,
			icon,
			fileFields,
			imageSource,
			title,
			subtitle,
			getLinkForItem,
			imageFit,
			sort,
			info,
			showingCount,
			isSingleRow,
			width,
			refresh,
			selectAll,
			resetPresetAndRefresh,
			filterUser,
			search,
			download,
		};

		async function resetPresetAndRefresh() {
			await props?.resetPreset?.();
			refresh();
		}

		function refresh() {
			getItems();
			getTotalCount();
			getItemCount();
		}

		function download() {
			if (!collection.value) return;
			saveAsCSV(collection.value, fields.value, items.value);
		}

		function toPage(newPage: number) {
			page.value = newPage;
		}

		function useLayoutOptions() {
			const size = createViewOption<number>('size', 4);
			const icon = createViewOption<string>('icon', 'box');
			const title = createViewOption<string | null>('title', null);
			const subtitle = createViewOption<string | null>('subtitle', null);
			const imageSource = createViewOption<string | null>('imageSource', fileFields.value[0]?.field ?? null);
			const imageFit = createViewOption<string>('imageFit', 'crop');

			return { size, icon, imageSource, title, subtitle, imageFit };

			function createViewOption<T>(key: keyof LayoutOptions, defaultValue: any) {
				return computed<T>({
					get() {
						return layoutOptions.value?.[key] !== undefined ? layoutOptions.value[key] : defaultValue;
					},
					set(newValue: T) {
						layoutOptions.value = {
							...layoutOptions.value,
							[key]: newValue,
						};
					},
				});
			}
		}

		function useLayoutQuery() {
			const page = syncRefProperty(layoutQuery, 'page', 1);
			const limit = syncRefProperty(layoutQuery, 'limit', 25);
			const defaultSort = computed(() => (primaryKeyField.value ? [primaryKeyField.value?.field] : []));
			const sort = syncRefProperty(layoutQuery, 'sort', defaultSort);

			const fields = computed<string[]>(() => {
				if (!primaryKeyField.value || !props.collection) return [];
				const fields = [primaryKeyField.value.field];

				if (imageSource.value) {
					fields.push(`${imageSource.value}.modified_on`);
					fields.push(`${imageSource.value}.type`);
					fields.push(`${imageSource.value}.filename_disk`);
					fields.push(`${imageSource.value}.storage`);
					fields.push(`${imageSource.value}.id`);
				}

				if (props.collection === 'directus_files' && imageSource.value === '$thumbnail') {
					fields.push('modified_on');
					fields.push('type');
				}

				const titleSubtitleFields: string[] = [];

				if (title.value) {
					titleSubtitleFields.push(...getFieldsFromTemplate(title.value));
				}

				if (subtitle.value) {
					titleSubtitleFields.push(...getFieldsFromTemplate(subtitle.value));
				}

				return [...fields, ...adjustFieldsForDisplays(titleSubtitleFields, props.collection)];
			});

			return { sort, limit, page, fields };
		}

		function getLinkForItem(item: Record<string, any>) {
			if (!primaryKeyField.value) return;

			return getItemRoute(props.collection, item[primaryKeyField.value.field]);
		}

		function selectAll() {
			if (!primaryKeyField.value) return;
			const pk = primaryKeyField.value;
			selection.value = items.value.map((item) => item[pk.field]);
		}
	},
});
