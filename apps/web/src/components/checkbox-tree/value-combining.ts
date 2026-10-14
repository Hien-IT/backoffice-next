// Ported from directus/app/src/components/v-checkbox-tree/VCheckboxTreeCheckbox.vue
// Backoffice: the <script setup> logic as plain functions over one node's props. Directus nests one component per
// group and every level rewrites the emitted value on its way up; BoCheckboxTree renders one flat Reka Tree and runs
// `setTreeValue` for the node, then for each ancestor, which is the same chain. `emitValue` returns instead of emitting.
import { difference } from 'lodash-es';

export type ValueCombining = 'all' | 'branch' | 'leaf' | 'indeterminate' | 'exclusive';

type Value = string | number;

type Delta = {
	added?: (number | string)[];
	removed?: (number | string)[];
};

export type CheckboxTreeNodeProps = {
	value: Value;
	valueCombining: ValueCombining;
	children: Record<string, any>[];
	modelValue: Value[];
	checked: boolean | null;
	itemValue: string;
	itemChildren: string;
};

export function checkboxTreeNode(props: CheckboxTreeNodeProps) {
	const childrenValues = props.children.map((child) => child[props.itemValue]);

	return { setTreeValue, groupCheckedStateOverride, groupIndeterminateState, childrenCheckedStateOverride };

	// Directus `treeValue` computed setter.
	function setTreeValue(newValue: Value[]): Value[] {
		const added = difference(newValue, props.modelValue);
		const removed = difference(props.modelValue, newValue);

		if (Array.isArray(props.children) && props.children.length > 0) {
			switch (props.valueCombining) {
				case 'all':
					return emitAll(newValue, { added, removed });
				case 'branch':
					return emitBranch(newValue, { added, removed });
				case 'leaf':
					return emitLeaf(newValue, { added, removed });
				case 'indeterminate':
					return emitIndeterminate(newValue, { added, removed });
				case 'exclusive':
					return emitExclusive(newValue, { added, removed });
				default:
					return emitValue(newValue);
			}
		}

		return emitValue(newValue);
	}

	function groupCheckedStateOverride() {
		if (props.checked !== null) return props.checked;
		if (props.valueCombining === 'all') return null;

		if (props.valueCombining === 'leaf') {
			const leafChildrenRecursive = getRecursiveChildrenValues('leaf');
			return leafChildrenRecursive.every((childVal) => props.modelValue.includes(childVal));
		}

		return null;
	}

	function groupIndeterminateState() {
		const allChildrenValues = getRecursiveChildrenValues('all');

		if (props.valueCombining === 'all' || props.valueCombining === 'branch') {
			return (
				allChildrenValues.some((childVal) => props.modelValue.includes(childVal)) &&
				props.modelValue.includes(props.value) === false
			);
		}

		if (props.valueCombining === 'indeterminate') {
			return (
				allChildrenValues.some((childVal) => props.modelValue.includes(childVal)) &&
				allChildrenValues.every((childVal) => props.modelValue.includes(childVal)) === false
			);
		}

		if (props.valueCombining === 'leaf') {
			const leafChildrenRecursive = getRecursiveChildrenValues('leaf');
			return (
				leafChildrenRecursive.some((childVal) => props.modelValue.includes(childVal)) &&
				leafChildrenRecursive.every((childVal) => props.modelValue.includes(childVal)) === false
			);
		}

		if (props.valueCombining === 'exclusive') {
			return allChildrenValues.some((childVal) => props.modelValue.includes(childVal));
		}

		return null;
	}

	function childrenCheckedStateOverride() {
		if (props.checked !== null) return props.checked;
		if (props.valueCombining === 'all') return null;

		if (props.valueCombining === 'branch') {
			if (props.modelValue.includes(props.value)) return true;
		}

		return null;
	}

	function emitAll(rawValue: (string | number)[], { added, removed }: Delta) {
		const childrenValuesRecursive = getRecursiveChildrenValues('all');

		// When enabling the group level
		if (added?.[0] === props.value) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && childrenValues.includes(val) === false),
				...childrenValuesRecursive,
				props.value,
			];

			return emitValue(newValue);
		}

		// When disabling the group level
		if (removed?.[0] === props.value) {
			const newValue = rawValue.filter((val) => val !== props.value && childrenValuesRecursive.includes(val) === false);
			return emitValue(newValue);
		}

		// When all children are clicked
		if (childrenValues.every((childVal) => rawValue.includes(childVal))) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && childrenValuesRecursive.includes(val) === false),
				...childrenValuesRecursive,
				props.value,
			];

			return emitValue(newValue);
		}

		const newValue = rawValue.filter((val) => val !== props.value);
		return emitValue(newValue);
	}

	function emitBranch(rawValue: (string | number)[], { added, removed }: Delta) {
		const allChildrenRecursive = getRecursiveChildrenValues('all');

		// Note: Added/removed is a tad confusing here, as an item that gets added to the array of
		// selected items can immediately be negated by the logic below, as it's potentially
		// replaced by the parent item's value

		// When clicking on an individual item in the enabled group
		if (
			(props.modelValue.includes(props.value) || props.checked === true) &&
			added &&
			added.length === 1 &&
			childrenValues.includes(added[0])
		) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && val !== added[0]),
				...childrenValues.filter((childVal) => childVal !== added[0]),
			];

			return emitValue(newValue);
		}

		// When a childgroup is modified
		if (
			props.modelValue.includes(props.value) &&
			allChildrenRecursive.some((childVal) => rawValue.includes(childVal))
		) {
			const childThatContainsSelection = props.children.find((child) => {
				const childNestedValues = getRecursiveChildrenValues('all', child[props.itemChildren]);
				return rawValue.some((rawVal) => childNestedValues.includes(rawVal)) === true;
			});

			const newValue = [
				...rawValue.filter((val) => val !== props.value),
				...props.children
					.filter((child) => {
						if (!child[props.itemChildren]) return true;
						return child[props.itemValue] !== childThatContainsSelection?.[props.itemValue];
					})
					.map((child) => child[props.itemValue]),
				...(childThatContainsSelection?.[props.itemChildren] ?? [])
					.filter((grandChild: Record<string, any>) => {
						const childNestedValues = getRecursiveChildrenValues('all', grandChild[props.itemChildren]);
						return rawValue.some((rawVal) => childNestedValues.includes(rawVal)) === false;
					})
					.map((grandChild: Record<string, any>) => grandChild[props.itemValue]),
			];

			return emitValue(newValue);
		}

		// When enabling the group level
		if (added?.includes(props.value)) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && allChildrenRecursive.includes(val) === false),
				props.value,
			];

			return emitValue(newValue);
		}

		// When disabling the group level
		if (removed?.includes(props.value)) {
			const newValue = rawValue.filter((val) => val !== props.value && allChildrenRecursive.includes(val) === false);
			return emitValue(newValue);
		}

		// When all children are clicked
		if (childrenValues.every((childVal) => rawValue.includes(childVal))) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && allChildrenRecursive.includes(val) === false),
				props.value,
			];

			return emitValue(newValue);
		}

		return emitValue(rawValue);
	}

	function emitLeaf(rawValue: (string | number)[], { added }: Delta) {
		const allChildrenRecursive = getRecursiveChildrenValues('all');
		const leafChildrenRecursive = getRecursiveChildrenValues('leaf');

		// When enabling the group level
		if (added?.includes(props.value)) {
			if (leafChildrenRecursive.every((childVal) => rawValue.includes(childVal))) {
				const newValue = rawValue.filter((val) => val !== props.value && allChildrenRecursive.includes(val) === false);
				return emitValue(newValue);
			} else {
				const newValue = [
					...rawValue.filter((val) => val !== props.value && allChildrenRecursive.includes(val) === false),
					...leafChildrenRecursive,
				];

				return emitValue(newValue);
			}
		}

		return emitValue(rawValue);
	}

	function emitIndeterminate(rawValue: (string | number)[], { added, removed }: Delta) {
		const childrenValuesRecursive = getRecursiveChildrenValues('all');

		// When enabling the group level
		if (added?.[0] === props.value) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && childrenValues.includes(val) === false),
				...childrenValuesRecursive,
				props.value,
			];

			return emitValue(newValue);
		}

		// When disabling the group level
		if (removed?.[0] === props.value) {
			const newValue = rawValue.filter((val) => val !== props.value && childrenValuesRecursive.includes(val) === false);
			return emitValue(newValue);
		}

		// When a child value is clicked
		if (childrenValues.some((childVal) => rawValue.includes(childVal))) {
			const newValue = [...rawValue.filter((val) => val !== props.value), props.value];

			return emitValue(newValue);
		}

		// When no children are clicked
		if (childrenValues.every((childVal) => rawValue.includes(childVal) === false)) {
			return emitValue(rawValue.filter((val) => val !== props.value));
		}

		return emitValue(rawValue);
	}

	function emitExclusive(rawValue: (string | number)[], { added }: Delta) {
		const childrenValuesRecursive = getRecursiveChildrenValues('all');

		// When enabling the group level
		if (added?.[0] === props.value) {
			const newValue = [
				...rawValue.filter((val) => val !== props.value && childrenValuesRecursive.includes(val) === false),
				props.value,
			];

			return emitValue(newValue);
		}

		// When a child value is clicked
		if (childrenValuesRecursive.some((childVal) => rawValue.includes(childVal))) {
			const newValue = [...rawValue.filter((val) => val !== props.value)];
			return emitValue(newValue);
		}

		return emitValue(rawValue);
	}

	function emitValue(newValue: (string | number)[]) {
		return newValue;
	}

	function getRecursiveChildrenValues(
		mode: 'all' | 'branch' | 'leaf',
		children: Record<string, any>[] = props.children,
	) {
		const values: (string | number)[] = [];

		getChildrenValuesRecursive(children);

		return values;

		function getChildrenValuesRecursive(children: Record<string, any>[]) {
			if (!children) return;

			for (const child of children) {
				if (mode === 'all') {
					values.push(child[props.itemValue]);
				}

				if (mode === 'branch' && child[props.itemChildren]) {
					values.push(child[props.itemValue]);
				}

				if (mode === 'leaf' && !child[props.itemChildren]) {
					values.push(child[props.itemValue]);
				}

				if (child[props.itemChildren]) {
					getChildrenValuesRecursive(child[props.itemChildren]);
				}
			}
		}
	}
}
