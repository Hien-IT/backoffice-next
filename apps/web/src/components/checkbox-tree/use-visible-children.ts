// Ported from directus/app/src/components/v-checkbox-tree/use-visible-children.ts
// Backoffice: a plain function over values instead of refs (BoCheckboxTree evaluates it per node while it builds the
// flat tree), and lodash-es `deburr` instead of the `diacritics` package (not a dependency of apps/web).
import { deburr as removeDiacritics } from 'lodash-es';

export function getVisibleChildrenValues(
	search: string | null,
	modelValue: (string | number)[],
	children: Record<string, any>[],
	showSelectionOnly: boolean,
	itemText: string,
	itemValue: string,
	itemChildren: string,
	parentValue: string | number | null,
	value: string | number,
): (string | number)[] {
	let options = children || [];
	const _search = search;

	if (_search) {
		options = options.filter((child) => {
			const normalizedItemText = removeDiacritics(child[itemText]).toLowerCase();

			return normalizedItemText.includes(_search) || childrenHaveSearchMatch(child[itemChildren]);
		});
	}

	if (showSelectionOnly) {
		options = options.filter(
			(child) =>
				modelValue.includes(child[itemValue]) ||
				childrenHaveValueMatch(child[itemChildren]) ||
				(parentValue && modelValue.includes(parentValue)) ||
				modelValue.includes(value),
		);
	}

	return options.map((child) => child[itemValue]);

	function childrenHaveSearchMatch(children: Record<string, any>[] | undefined): boolean {
		if (!children || !_search) return false;
		return children.some((child) => {
			const normalizedItemText = removeDiacritics(child[itemText]).toLowerCase();

			return normalizedItemText.includes(_search) || childrenHaveSearchMatch(child[itemChildren]);
		});
	}

	function childrenHaveValueMatch(children: Record<string, any>[] | undefined): boolean {
		if (!children) return false;
		return children.some(
			(child) => modelValue.includes(child[itemValue]) || childrenHaveValueMatch(child[itemChildren]),
		);
	}
}
