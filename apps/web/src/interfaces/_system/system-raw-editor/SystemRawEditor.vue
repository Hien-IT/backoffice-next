<!-- Ported from directus/app/src/interfaces/_system/system-raw-editor/system-raw-editor.vue -->
<script setup lang="ts">
// Backoffice: template and CodeMirror styles follow the EditorFrame recipe (FIELD border on the frame, the shared
// styles/codemirror-theme.css for the editor, light and dark, FR-095) instead of the global Directus
// `_codemirror.scss`; the placeholder addon is
// imported here (Directus loads it through input-code). `id` and `aria-labelledby` reach the CodeMirror textarea (FR-094).
import { isValidJSON, parseJSON } from '@directus/utils';
import { useWindowSize } from '@vueuse/core';
import CodeMirror from 'codemirror';
import 'codemirror/addon/display/placeholder.js';
import 'codemirror/addon/mode/simple.js';
import 'codemirror/lib/codemirror.css';
import { computed, onMounted, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getStringifiedValue } from '../../../components/form/utils/get-stringified-value.ts';
import '../../../styles/codemirror-theme.css';
import { mustacheMode } from './mustache-mode.ts';

const props = withDefaults(
	defineProps<{
		value?: string | object | null | undefined;
		autofocus?: boolean;
		disabled?: boolean;
		type?: string | undefined;
		language?: string;
		placeholder?: string | undefined;
		id?: string | undefined;
		ariaLabelledby?: string | undefined;
	}>(),
	{
		value: undefined,
		autofocus: false,
		disabled: false,
		type: undefined,
		placeholder: undefined,
		language: 'mustache',
		id: undefined,
		ariaLabelledby: undefined,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

const { width } = useWindowSize();

const codemirrorEl = ref<HTMLDivElement | null>();
let codemirror: CodeMirror.Editor | null;
let previousContent: string | null = null;

const isMultiLine = computed(() => ['text', 'json'].includes(props.type!));

const isObjectLike = computed(() => {
	if (props.type === 'json' || props.type === 'csv' || props.type?.startsWith('geometry')) return true;
	return false;
});

onMounted(async () => {
	if (codemirrorEl.value) {
		CodeMirror.defineSimpleMode('mustache', mustacheMode);

		codemirror = CodeMirror(codemirrorEl.value, {
			mode: props.language,
			value: getStringifiedValue(props.value, unref(isObjectLike)),
			tabSize: 0,
			autoRefresh: true,
			indentUnit: 4,
			styleActiveLine: true,
			highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true, delay: 100 },
			matchBrackets: true,
			showCursorWhenSelecting: true,
			lineWiseCopyCut: false,
			theme: 'default',
			scrollbarStyle: isMultiLine.value ? 'native' : 'null',
			extraKeys: { Ctrl: 'autocomplete', Tab: false, 'Shift-Tab': false },
			cursorBlinkRate: props.disabled ? -1 : 530,
			placeholder: props.placeholder !== undefined ? props.placeholder : t('raw_editor_placeholder'),
			readOnly: readOnly.value,
		} as CodeMirror.EditorConfiguration);

		// Backoffice: label the hidden textarea CodeMirror types into (FR-094).
		const input = codemirror.getInputField();
		if (props.id) input.id = props.id;
		if (props.ariaLabelledby) input.setAttribute('aria-labelledby', props.ariaLabelledby);
		if (props.autofocus && !props.disabled) codemirror.focus();

		// prevent new lines for single lines
		if (!isMultiLine.value) {
			codemirror.on('beforeChange', function (_doc, { origin, text, cancel, update }) {
				const typedNewLine = origin === '+input' && typeof text === 'object' && text.join('') === '';
				if (typedNewLine) return cancel();

				const pastedNewLine = origin === 'paste' && typeof text === 'object' && text.length > 1;

				if (pastedNewLine) {
					const newText = text.join(' ');
					if (!update) return;
					return update(undefined, undefined, [newText]);
				}

				return null;
			});
		}

		codemirror.on('change', (doc, { origin }) => {
			const content = doc.getValue();

			// prevent duplicate emits with same content
			if (content === previousContent) return;
			previousContent = content;

			if (origin === 'setValue') return;

			if (content === '') {
				emit('input', null);
			} else {
				emit('input', unref(isObjectLike) && isValidJSON(content) ? parseJSON(content) : content);
			}
		});
	}
});

const readOnly = computed(() => {
	if (width.value < 600) {
		// mobile requires 'nocursor' to avoid bringing up the keyboard
		return props.disabled ? 'nocursor' : false;
	} else {
		// desktop cannot use 'nocursor' as it prevents copy/paste
		return props.disabled;
	}
});

watch(
	() => props.disabled,
	(disabled) => {
		codemirror?.setOption('readOnly', readOnly.value);
		codemirror?.setOption('cursorBlinkRate', disabled ? -1 : 530);
	},
	{ immediate: true },
);

watch(
	() => props.value,
	(newValue) => {
		const currentValue = codemirror?.getValue();

		if (currentValue !== newValue) {
			codemirror?.setValue(getStringifiedValue(newValue, unref(isObjectLike)));
		}
	},
);
</script>

<template>
	<div
		class="system-raw-editor bo-codemirror overflow-hidden rounded-lg border shadow-theme-xs"
		:class="[
			disabled
				? 'disabled border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]'
				: 'border-gray-500 bg-transparent focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:focus-within:border-brand-400',
			{ 'multi-line': isMultiLine },
		]"
	>
		<div ref="codemirrorEl"></div>
	</div>
</template>

<style>
/* Colors and padding come from styles/codemirror-theme.css (.bo-codemirror); one line high unless multi-line. */
.system-raw-editor .CodeMirror,
.system-raw-editor .CodeMirror-scroll {
	max-height: 2.625rem;
}

.system-raw-editor.multi-line .CodeMirror,
.system-raw-editor.multi-line .CodeMirror-scroll {
	max-height: 27rem;
}
</style>
