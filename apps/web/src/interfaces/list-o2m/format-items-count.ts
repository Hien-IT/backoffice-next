// Ported from directus/app/src/utils/format-items-count.ts
// Backoffice: only formatItemsCountPaginated (the list interfaces use it); kept next to list-o2m until it moves to
// src/utils with the next user.
import type { ComposerNumberFormatting, ComposerTranslation } from 'vue-i18n';

export type FormatItemsCountPaginatedOptions = {
	currentItems: number;
	currentPage: number;
	perPage: number;
	isFiltered?: boolean;
	totalItems?: number;
	i18n: { t: ComposerTranslation; n: ComposerNumberFormatting };
};

export function formatItemsCountPaginated({
	currentItems,
	currentPage,
	perPage,
	isFiltered,
	totalItems,
	i18n,
}: FormatItemsCountPaginatedOptions) {
	const { t, n } = i18n;

	const values = {
		start: n((currentPage - 1) * perPage + 1),
		end: n(Math.min(currentPage * perPage, currentItems)),
		count: n(currentItems),
	};

	// If filter is active and has effect on items
	if (isFiltered && (totalItems === undefined || currentItems < totalItems)) {
		if (currentItems <= perPage) return t('filtered_item_count', values, currentItems);

		return t('start_end_of_count_filtered_items', values);
	}

	if (currentItems > perPage) return t('start_end_of_count_items', values);

	return t('item_count', values, currentItems);
}
