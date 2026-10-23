<!-- Ported from directus/app/src/components/v-template-input.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the contenteditable template input of DR with the Input recipe; the
// caret helpers replace `caret-pos` (not a dependency): the position is the text length before the caret, as
// caret-pos counts it. The element is a `textbox` (name from the extension's aria-label / aria-labelledby).
import { useEventListener } from '@vueuse/core';
import { onMounted, ref, watch } from 'vue';

/** caret-pos `position(el).pos`: the text length from the start of `el` to the caret. */
function caretPosition(el: HTMLElement): number {
	const range = window.getSelection()!.getRangeAt(0);
	const before = range.cloneRange();
	before.selectNodeContents(el);
	before.setEnd(range.endContainer, range.endOffset);
	return before.toString().length;
}

const escapeHTML = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** caret-pos `position(el, pos)`: a collapsed caret after `pos` characters of the text nodes of `el`. */
function setCaretPosition(el: HTMLElement, pos: number) {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	let offset = 0;

	for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
		if (offset + node.length >= pos) {
			const range = document.createRange();
			range.setStart(node, pos - offset);
			window.getSelection()?.removeAllRanges();
			window.getSelection()?.addRange(range);
			return;
		}

		offset += node.length;
	}
}

interface Props {
	captureGroup: string;
	triggerCharacter: string;
	items: Record<string, string>;
	modelValue?: string | undefined;
	multiline?: boolean;
	placeholder?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: undefined,
	multiline: false,
	placeholder: undefined,
});

const emit = defineEmits(['update:modelValue', 'trigger', 'deactivate', 'up', 'down', 'enter']);

type HTMLEditableDivElement = HTMLDivElement & Pick<HTMLInputElement, 'value'>;

const input = ref<HTMLEditableDivElement | null>(null);

let hasTriggered = false;
let matchedPositions: number[] = [];
let previousInnerTextLength = 0;
let previousCaretPos = 0;

watch(
	() => props.modelValue,
	(newText) => {
		if (!input.value) return;

		if (newText !== input.value.innerText) {
			parseHTML(newText, true);
		}
	},
);

onMounted(() => {
	if (props.modelValue && props.modelValue !== input.value?.innerText) {
		parseHTML(props.modelValue);
	}
});

useEventListener(input, 'click', checkClick);
useEventListener(input, 'keydown', checkKeyDown);
useEventListener(input, 'keyup', checkKeyUp);

function checkClick(event: MouseEvent) {
	const input = event.target as HTMLEditableDivElement;

	const caretPos = window.getSelection()?.rangeCount ? caretPosition(input) : 0;

	const checkCaretPos = matchedPositions.indexOf(caretPos);

	if (checkCaretPos !== -1) {
		if (checkCaretPos % 2 === 0) {
			setCaretPosition(input, caretPos - 1);
		} else {
			setCaretPosition(input, caretPos + 1);
		}

		event.preventDefault();
	}
}

function checkKeyDown(event: KeyboardEvent) {
	const input = event.target as HTMLEditableDivElement;

	const caretPos = window.getSelection()?.rangeCount ? caretPosition(input) : 0;

	if (event.code === 'Enter') {
		event.preventDefault();

		if (hasTriggered) {
			emit('enter');
		} else {
			parseHTML(
				input.innerText.substring(0, caretPos) +
					(caretPos === input.innerText.length && input.innerText.charAt(caretPos - 1) !== '\n' ? '\n\n' : '\n') +
					input.innerText.substring(caretPos),
				true,
			);

			setCaretPosition(input, caretPos + 1);
		}
	} else if (event.code === 'ArrowUp' && !event.shiftKey) {
		if (hasTriggered) {
			event.preventDefault();

			emit('up');
		}
	} else if (event.code === 'ArrowDown' && !event.shiftKey) {
		if (hasTriggered) {
			event.preventDefault();

			emit('down');
		}
	} else if (event.code === 'ArrowLeft' && !event.shiftKey) {
		const checkCaretPos = matchedPositions.indexOf(caretPos - 1);

		if (checkCaretPos !== -1 && checkCaretPos % 2 === 1) {
			event.preventDefault();

			setCaretPosition(input, matchedPositions[checkCaretPos - 1]! - 1);
		}
	} else if (event.code === 'ArrowRight' && !event.shiftKey) {
		const checkCaretPos = matchedPositions.indexOf(caretPos + 1);

		if (checkCaretPos !== -1 && checkCaretPos % 2 === 0) {
			event.preventDefault();

			setCaretPosition(input, matchedPositions[checkCaretPos + 1]! + 1);
		}
	} else if (event.code === 'Backspace') {
		const checkCaretPos = matchedPositions.indexOf(caretPos - 1);

		if (checkCaretPos !== -1 && checkCaretPos % 2 === 1) {
			event.preventDefault();

			const newCaretPos = matchedPositions[checkCaretPos - 1];

			parseHTML(
				(input.innerText.substring(0, newCaretPos) + input.innerText.substring(caretPos)).replaceAll(
					String.fromCharCode(160),
					' ',
				),
				true,
			);

			setCaretPosition(input, newCaretPos!);
			emit('update:modelValue', input.innerText);
		}
	} else if (event.code === 'Delete') {
		const checkCaretPos = matchedPositions.indexOf(caretPos + 1);

		if (checkCaretPos !== -1 && checkCaretPos % 2 === 0) {
			event.preventDefault();

			parseHTML(
				(
					input.innerText.substring(0, caretPos) + input.innerText.substring(matchedPositions[checkCaretPos + 1]!)
				).replaceAll(String.fromCharCode(160), ' '),
				true,
			);

			setCaretPosition(input, caretPos);
			emit('update:modelValue', input.innerText);
		}
	}
}

function checkKeyUp(event: KeyboardEvent) {
	const input = event.target as HTMLEditableDivElement;

	const caretPos = window.getSelection()?.rangeCount ? caretPosition(input) : 0;

	if ((event.code === 'ArrowUp' || event.code === 'ArrowDown') && !event.shiftKey) {
		const checkCaretPos = matchedPositions.indexOf(caretPos);

		if (checkCaretPos !== -1 && checkCaretPos % 2 === 1) {
			setCaretPosition(input, matchedPositions[checkCaretPos]! + 1);
		} else if (checkCaretPos !== -1 && checkCaretPos % 2 === 0) {
			setCaretPosition(input, matchedPositions[checkCaretPos]! - 1);
		}
	}
}

function processText(event: Event) {
	const input = event.target as HTMLEditableDivElement;

	const caretPos = window.getSelection()?.rangeCount ? caretPosition(input) : 0;

	const text = input.innerText ?? '';

	let endPos = text.indexOf(' ', caretPos);
	if (endPos === -1) endPos = text.indexOf('\n', caretPos);
	if (endPos === -1) endPos = text.length;
	const result = /\S+$/.exec(text.slice(0, endPos));
	let word = result ? result[0] : null;
	if (word) word = word.replace(/[\s'";:,./?\\-]$/, '');

	if (word?.startsWith(props.triggerCharacter)) {
		emit('trigger', { searchQuery: word.substring(props.triggerCharacter.length), caretPosition: caretPos });
		hasTriggered = true;
	} else {
		if (hasTriggered) {
			emit('deactivate');
			hasTriggered = false;
		}
	}

	parseHTML();

	emit('update:modelValue', input.innerText);
}

function parseHTML(innerText?: string, isDirectInput = false) {
	if (!input.value) return;

	if (input.value.innerText === '\n') {
		input.value.innerText = '';
	}

	if (innerText !== undefined) {
		input.value.innerText = innerText;
		hasTriggered = false;
	}

	// Backoffice: the text is escaped before it becomes HTML (DR sets the raw text, so a stored value with markup
	// would run); the escaped set is the one innerHTML serializes, so the comparison below still holds.
	let newHTML = escapeHTML(input.value.innerText);
	let caretPos = 0;

	if (isDirectInput) {
		caretPos = previousCaretPos;
	} else if (window.getSelection()?.rangeCount) {
		caretPos = caretPosition(input.value);
	}

	let lastMatchIndex = 0;
	const matches = newHTML.match(new RegExp(`${props.captureGroup}(?!</mark>)`, 'gi'));
	matchedPositions = [];

	if (matches) {
		for (const match of matches ?? []) {
			let replaceSpaceBefore = '';
			let replaceSpaceAfter = '';
			let addSpaceBefore = '';
			let addSpaceAfter = '';

			const htmlMatchIndex = newHTML.indexOf(match, lastMatchIndex);
			const charCodeBefore = newHTML.charCodeAt(htmlMatchIndex - 1);
			const charCodeAfter = newHTML.charCodeAt(htmlMatchIndex + match.length);

			if (charCodeBefore === 32) {
				replaceSpaceBefore = ' ';
				addSpaceBefore = '&nbsp;';
			} else if (charCodeBefore !== 160) {
				addSpaceBefore = '&nbsp;';
			}

			if (charCodeAfter === 32) {
				replaceSpaceAfter = ' ';
				addSpaceAfter = '&nbsp;';
			} else if (charCodeAfter !== 160) {
				addSpaceAfter = '&nbsp;';
			}

			const searchString = replaceSpaceBefore + match + replaceSpaceAfter;

			const replacementString = `${addSpaceBefore}<mark class="preview" data-preview="${escapeHTML(
				String(props.items[match.substring(props.triggerCharacter.length)]),
			).replaceAll('"', '&quot;')}" contenteditable="false">${match}</mark>${addSpaceAfter}`;

			newHTML = newHTML.replace(new RegExp(`(${searchString})(?!</mark>)`), replacementString);
			lastMatchIndex = htmlMatchIndex + replacementString.length - searchString.length;
		}
	}

	let targetPosition = caretPos;

	if (isDirectInput || !window.getSelection()?.rangeCount) {
		targetPosition += input.value.innerText.length - previousInnerTextLength;
	}

	if (input.value.innerHTML !== newHTML.replaceAll(String.fromCharCode(160), '&nbsp;')) {
		input.value.innerHTML = newHTML;

		if (targetPosition > input.value.innerText.length || targetPosition < 0) {
			setCaretPosition(input.value, input.value.innerText.length);
		} else {
			setCaretPosition(input.value, targetPosition);
		}
	}

	lastMatchIndex = 0;

	for (const match of matches ?? []) {
		const matchIndex = input.value.innerText.indexOf(match, lastMatchIndex);
		matchedPositions.push(matchIndex, matchIndex + match.length);
		lastMatchIndex = matchIndex + match.length;
	}

	previousInnerTextLength = input.value.innerText.length;
	previousCaretPos = targetPosition;
}

const PREVIEW =
	'[&_.preview]:inline-block [&_.preview]:rounded-md [&_.preview]:bg-brand-50 [&_.preview]:px-1 [&_.preview]:py-0.5 [&_.preview]:align-[-0.125rem] [&_.preview]:text-[length:0] [&_.preview]:leading-none [&_.preview]:text-brand-600 [&_.preview]:before:block [&_.preview]:before:text-theme-xs [&_.preview]:before:content-[attr(data-preview)] dark:[&_.preview]:bg-brand-500/15 dark:[&_.preview]:text-brand-400';
// Input recipe (FIELD + FIELD_VALID of BoInput); the placeholder is the `:empty::before` of DR.
const FIELD =
	'relative w-full overflow-hidden rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 empty:before:pointer-events-none empty:before:text-gray-500 empty:before:content-[attr(data-placeholder)] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-400 dark:focus-visible:outline-brand-400 dark:empty:before:text-gray-400';
</script>

<template>
	<div
		ref="input"
		class="v-template-input"
		:class="[FIELD, PREVIEW, multiline ? 'h-24 overflow-y-auto whitespace-pre-wrap' : 'h-11 whitespace-nowrap']"
		contenteditable="true"
		tabindex="0"
		role="textbox"
		:aria-multiline="multiline"
		:aria-placeholder="placeholder"
		:data-placeholder="placeholder"
		@input="processText"
	/>
</template>
