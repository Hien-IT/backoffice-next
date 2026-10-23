<!-- Ported from directus/app/src/components/v-field-template/v-field-template.vue; Ported from directus/app/src/utils/flatten-field-groups.ts -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the DR chip editor (contenteditable with a button per field, removed by
// click, Enter or Space) in the Input recipe; the field menu is a Reka popover with FieldList on the given `tree`
// (FieldListItem: `depth`, `loadPathLevel` when a node opens). `{` or `}` opens the menu. The attributes (aria-label,
// aria-labelledby) go to the `textbox`.
import dompurify from 'dompurify';
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import FieldList from '../../components/FieldList.vue';
import type { FieldNode } from '../../composables/use-field-tree.ts';
import { FOCUS } from './list.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		disabled?: boolean | undefined;
		modelValue?: string | null | undefined;
		nullable?: boolean;
		tree: FieldNode[];
		loadPathLevel?: (fieldPath: string, root?: FieldNode | undefined) => void;
		depth?: number | undefined;
		placeholder?: string | null | undefined;
	}>(),
	{
		disabled: false,
		modelValue: null,
		nullable: true,
		depth: undefined,
		placeholder: null,
	},
);

/** Ported from directus/app/src/utils/flatten-field-groups.ts: the tree without the group nodes. */
function flattenFieldGroups(list: FieldNode[]): FieldNode[] {
	return list.flatMap((item: FieldNode) => {
		if (Array.isArray(item.children) && item.children.length > 0) {
			if (item.group === true) {
				return flattenFieldGroups(item.children);
			} else {
				item.children = flattenFieldGroups(item.children);
			}
		}

		return item;
	});
}

const emit = defineEmits(['update:modelValue']);

const contentEl = ref<HTMLElement | null>(null);

const menuActive = ref(false);

// Backoffice: the caret of the content when the menu opens, put back before a field is inserted (focus moves into the
// menu, which may move the selection).
let savedRange: Range | null = null;

function onMenu(open: boolean) {
	menuActive.value = open;
	const selection = window.getSelection();
	const range = open && selection?.rangeCount ? selection.getRangeAt(0) : null;
	savedRange = range && contentEl.value?.contains(range.startContainer) ? range.cloneRange() : null;
}

/** FieldList emits keys: the node of a key (`a.b`) in the tree without groups. */
function onAdd(key: string) {
	const field = findTree(grouplessTree.value, key.split('.'));
	if (!field) return;

	window.getSelection()?.removeAllRanges();
	if (savedRange) window.getSelection()?.addRange(savedRange);
	addField(field);
	menuActive.value = false;
}

watch(() => props.modelValue, setContent, { immediate: true });

const grouplessTree = computed(() => {
	return flattenFieldGroups(props.tree);
});

onMounted(() => {
	if (contentEl.value) {
		contentEl.value.addEventListener('selectstart', onSelect);
		setContent();
	}
});

onUnmounted(() => {
	if (contentEl.value) {
		contentEl.value.removeEventListener('selectstart', onSelect);
	}
});

function onInput() {
	if (!contentEl.value) return;

	const valueString = getInputValue();
	emit('update:modelValue', valueString);
}

function onClick(event: MouseEvent) {
	const target = event.target as HTMLElement;
	if (target.tagName.toLowerCase() !== 'button') return;
	removeField(target);
}

function onKeyDown(event: KeyboardEvent) {
	// Backoffice: DR reads currentTarget (always the content) with an inverted `isButton`, so Enter was never
	// blocked and Space ran removeField on the content; here Enter adds no line and Enter/Space on a field removes it.
	const target = event.target as HTMLElement;
	const isButton = target?.tagName.toLowerCase() === 'button';

	if (!isButton && event.key === 'Enter') {
		event.preventDefault();
	}

	if (isButton && ['Enter', ' '].includes(event.key)) {
		event.preventDefault();
		removeField(target);
	}

	if (event.key === '{' || event.key === '}') {
		event.preventDefault();
		onMenu(true);
	}

	if (contentEl.value?.innerHTML === '') {
		contentEl.value.innerHTML = '<span class="text"></span>';
	}
}

function onSelect() {
	if (!contentEl.value) return;
	const selection = window.getSelection();
	if (!selection || selection.rangeCount <= 0) return;
	const range = selection.getRangeAt(0);
	if (!range) return;
	const start = range.startContainer;

	if (
		!(start instanceof HTMLElement && start.classList.contains('text')) &&
		!start.parentElement?.classList.contains('text')
	) {
		selection.removeAllRanges();
		const range = new Range();
		let textSpan = null;

		for (let i = 0; i < contentEl.value.childNodes.length || !textSpan; i++) {
			const child = contentEl.value.children[i];

			if (child?.classList.contains('text')) {
				textSpan = child;
			}
		}

		if (!textSpan) {
			textSpan = document.createElement('span');
			textSpan.classList.add('text');
			contentEl.value.appendChild(textSpan);
		}

		range.setStart(textSpan as Node, 0);
		selection.addRange(range);
	}
}

function addField(field: FieldNode) {
	if (!contentEl.value) return;

	const button = document.createElement('button');
	button.dataset['field'] = field.key;
	button.setAttribute('contenteditable', 'false');
	button.classList.add('selected-field');
	button.innerText = String(field.name);

	if (window.getSelection()?.rangeCount == 0) {
		const range = document.createRange();
		range.selectNodeContents(contentEl.value.children[0] as Node);
		window.getSelection()?.addRange(range);
	}

	const range = window.getSelection()?.getRangeAt(0);
	if (!range) return;
	range.deleteContents();

	const end = splitElements();

	if (end) {
		contentEl.value.insertBefore(button, end);
		window.getSelection()?.removeAllRanges();
	} else {
		contentEl.value.appendChild(button);
		const span = document.createElement('span');
		span.classList.add('text');
		contentEl.value.appendChild(span);
	}

	onInput();
}

function removeField(target: HTMLElement) {
	const field = target.dataset['field'];
	emit('update:modelValue', props.modelValue?.replace(`{{${field}}}`, ''));

	const before = target.previousElementSibling;
	const after = target.nextElementSibling;

	if (!before || !after || !(before instanceof HTMLElement) || !(after instanceof HTMLElement)) return;

	target.remove();
	joinElements(before, after);
	window.getSelection()?.removeAllRanges();
	onInput();

	contentEl.value?.focus();
}

function findTree(tree: FieldNode[] | undefined, fieldSections: string[]): FieldNode | undefined {
	if (tree === undefined) return undefined;

	const fieldObject = tree.find((f) => f.field === fieldSections[0]);

	if (fieldObject === undefined) return undefined;
	if (fieldSections.length === 1) return fieldObject;
	return findTree(fieldObject.children, fieldSections.slice(1));
}

function joinElements(first: HTMLElement, second: HTMLElement) {
	first.innerText += second.innerText;
	second.remove();
}

function splitElements() {
	const range = window.getSelection()?.getRangeAt(0);
	if (!range) return;

	const textNode = range.startContainer;
	if (textNode.nodeType !== Node.TEXT_NODE) return;
	const start = textNode.parentElement;
	if (!start || !(start instanceof HTMLSpanElement) || !start.classList.contains('text')) return;

	const startOffset = range.startOffset;

	const left = start.textContent?.slice(0, startOffset) || '';
	const right = start.textContent?.slice(startOffset) || '';

	start.innerText = left;

	const nextSpan = document.createElement('span');
	nextSpan.classList.add('text');
	nextSpan.innerText = right;
	contentEl.value?.insertBefore(nextSpan, start.nextSibling);
	return nextSpan;
}

function getInputValue() {
	if (!contentEl.value) return null;

	const value = Array.from(contentEl.value.childNodes).reduce((acc, node) => {
		const el = node as HTMLElement;
		const tag = el.tagName;

		if (tag && tag.toLowerCase() === 'button') return (acc += `{{${el.dataset['field']}}}`);
		else if ('textContent' in el) return (acc += el.textContent);

		return (acc += '');
	}, '');

	if (props.nullable === true && value === '') {
		return null;
	}

	return value;
}

function setContent() {
	if (!contentEl.value) return;

	if (props.modelValue === null || props.modelValue === '') {
		contentEl.value.innerHTML = '<span class="text"></span>';
		return;
	}

	if (props.modelValue !== getInputValue()) {
		const regex = /({{.*?}})/g;

		const newInnerHTML = props.modelValue
			.split(regex)
			.map((part) => {
				if (part.startsWith('{{') === false) {
					return `<span class="text">${part}</span>`;
				}

				const fieldKey = part.replace(/({|})/g, '').trim();
				const fieldPath = fieldKey.split('.');

				for (let i = 0; i < fieldPath.length; i++) {
					props.loadPathLevel?.(fieldPath.slice(0, i).join('.'));
				}

				const field = findTree(grouplessTree.value, fieldPath);

				if (!field) return '';

				return `<button type="button" contenteditable="false" data-field="${fieldKey}" ${
					props.disabled ? 'disabled' : ''
				} class="selected-field">${field.name}</button>`;
			})
			.join('');

		contentEl.value.innerHTML = dompurify.sanitize(newInnerHTML, {
			ALLOWED_TAGS: ['span', 'button'],
			ALLOWED_ATTR: ['type', 'contenteditable', 'data-field', 'disabled', 'class'],
		});
	}
}

const FIELD =
	'relative flex h-11 w-full items-center gap-2 rounded-lg border border-gray-300 bg-transparent ps-4 pe-1.5 text-sm text-gray-800 shadow-theme-xs focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus-within:border-brand-400';
const DISABLED =
	'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03]';
// DR `.content` and `:deep(.selected-field)`: monospace text spans and the field chips (danger on hover).
const CONTENT =
	'block min-w-0 flex-1 overflow-hidden py-2.5 font-mono text-theme-xs whitespace-nowrap outline-hidden [&>*]:inline-block [&>*]:whitespace-nowrap [&_br]:hidden [&_span]:min-h-[1em] [&_span]:min-w-px [&_span]:whitespace-pre [&_.selected-field]:mx-1 [&_.selected-field]:rounded-md [&_.selected-field]:bg-brand-50 [&_.selected-field]:px-1 [&_.selected-field]:text-brand-600 [&_.selected-field:not(:disabled)]:hover:bg-error-600 [&_.selected-field:not(:disabled)]:hover:text-white dark:[&_.selected-field]:bg-brand-500/15 dark:[&_.selected-field]:text-brand-400';
const ICON_BTN =
	'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300';
const POPOVER =
	'z-99999 max-h-(--reka-popover-content-available-height) w-(--reka-popover-trigger-width) min-w-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark';
</script>

<template>
	<PopoverRoot :open="menuActive" @update:open="onMenu">
		<PopoverAnchor as-child>
			<div class="v-field-template" :class="[FIELD, { [DISABLED]: disabled }]">
				<span
					v-bind="$attrs"
					ref="contentEl"
					role="textbox"
					:aria-disabled="disabled || undefined"
					:aria-placeholder="placeholder ?? undefined"
					:class="[CONTENT, FOCUS]"
					:contenteditable="!disabled"
					@keydown="onKeyDown"
					@input="onInput"
					@click="onClick"
				>
					<span class="text" />
				</span>
				<span
					v-if="placeholder && !modelValue"
					class="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 select-none text-gray-500 dark:text-gray-400"
					aria-hidden="true"
				>
					{{ placeholder }}
				</span>
				<PopoverTrigger
					:class="[ICON_BTN, FOCUS]"
					:disabled="disabled"
					:aria-label="$t('add_field')"
					:title="$t('add_field')"
				>
					<BoIcon name="add_box" size="sm" />
				</PopoverTrigger>
			</div>
		</PopoverAnchor>
		<PopoverPortal>
			<PopoverContent v-if="!disabled" :side-offset="4" align="end" :collision-padding="8" :class="POPOVER">
				<FieldList
					collection=""
					:field-tree="tree"
					:depth="depth"
					:load-path-level="loadPathLevel"
					@add="onAdd($event[0]!)"
				/>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
