<!-- Ported from directus/app/src/interfaces/input-code/input-code.vue -->
<script setup lang="ts">
// Backoffice: EditorFrame recipe (FIELD border on the frame, CodeMirror colors from codemirror-theme.css on the theme
// tokens, light and dark) instead of the global Directus `_codemirror.scss`; the template button is an ICON_BTN with a
// Tooltip; the form ids reach the CodeMirror textarea like system-raw-editor (FORM_FIELD_A11Y, FR-094).
import { useWindowSize } from '@vueuse/core';
import CodeMirror, { type ModeSpec } from 'codemirror';
import { computed, inject, onMounted, type Ref, ref, watch } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import { getStringifiedValue } from '../../components/form/utils/get-stringified-value.ts';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import importCodemirrorMode from './import-codemirror-mode.ts';

import 'codemirror/lib/codemirror.css';
import '../../styles/codemirror-theme.css';

import 'codemirror/mode/meta.js';

import 'codemirror/addon/comment/comment.js';
import 'codemirror/addon/dialog/dialog.js';
import 'codemirror/addon/display/placeholder.js';
import 'codemirror/addon/lint/lint.js';
import 'codemirror/addon/scroll/annotatescrollbar.js';
import 'codemirror/addon/search/matchesonscrollbar.js';
import 'codemirror/addon/search/search.js';
import 'codemirror/addon/search/searchcursor.js';

import 'codemirror/keymap/sublime.js';

/** Regex to check for interpolation, e.g. `{{ $trigger }}` */
const INTERPOLATION_REGEX = /^\{\{\s*[^}\s]+\s*\}\}$/;

const props = withDefaults(
	defineProps<{
		value?: string | Record<string, unknown> | unknown[] | boolean | number | null | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		altOptions?: Record<string, any> | undefined;
		template?: string | undefined;
		lineNumber?: boolean;
		lineWrapping?: boolean;
		placeholder?: string | undefined;
		language?: string;
		type?: string | undefined;
	}>(),
	{
		value: undefined,
		altOptions: undefined,
		template: undefined,
		lineNumber: true,
		placeholder: undefined,
		language: 'plaintext',
		type: undefined,
	},
);

const emit = defineEmits(['input']);

const { width } = useWindowSize();

const a11y = inject(FORM_FIELD_A11Y, null);

const codemirrorEl: Ref<HTMLTextAreaElement | null> = ref(null);
let codemirror: CodeMirror.Editor | null;
let previousContent: string | null = null;

onMounted(async () => {
	if (codemirrorEl.value) {
		await getImports(cmOptions.value);

		await importCodemirrorMode(cmOptions.value['mode']);

		codemirror = CodeMirror(codemirrorEl.value, {
			...cmOptions.value,
			value: stringValue.value,
		});

		// Backoffice: label the hidden textarea CodeMirror types into (FR-094).
		linkInput();

		codemirror.setOption('mode', { name: 'javascript ' });

		await setLanguage();

		codemirror.on('change', (cm, { origin }) => {
			const content = cm.getValue();

			// prevent duplicate emits with same content
			if (content === previousContent) return;
			previousContent = content;

			if (origin === 'setValue') return;

			if (props.type === 'json') {
				if (content.length === 0) {
					return emit('input', null);
				}

				if (isInterpolation(content)) {
					return emit('input', content);
				}

				try {
					const parsedJson = JSON.parse(content);
					if (typeof parsedJson !== 'string') return emit('input', parsedJson);
					return emit('input', content);
				} catch {
					// We won't stage invalid JSON
				}
			} else {
				emit('input', content);
			}
		});
	}
});

function linkInput() {
	const input = codemirror?.getInputField();
	if (!input || !a11y) return;

	input.id = a11y.value.inputId;
	input.setAttribute('aria-labelledby', a11y.value.labelId);
	if (a11y.value.describedBy) input.setAttribute('aria-describedby', a11y.value.describedBy);
	else input.removeAttribute('aria-describedby');
	if (a11y.value.invalid) input.setAttribute('aria-invalid', 'true');
	else input.removeAttribute('aria-invalid');
}

watch(() => a11y?.value, linkInput);

const stringValue = computed(() => {
	if (props.value === null || props.value === undefined) return '';

	if (props.type === 'json' && isInterpolation(props.value)) return props.value as string;

	return getStringifiedValue(props.value, props.type === 'json');
});

watch(
	() => props.language,
	() => {
		setLanguage();
	},
);

watch(stringValue, () => {
	// prevent setting redundantly stringified json value when it's actually the same value
	if (props.type === 'json' && codemirror?.getValue() === props.value) return;

	if (codemirror?.getValue() !== stringValue.value) {
		codemirror?.setValue(stringValue.value || '');
	}
});

async function setLanguage() {
	if (codemirror) {
		const lang = (props.language || 'plaintext').toLowerCase();

		if (props.type === 'json' || lang === 'json') {
			// @ts-expect-error -- the CodeMirror mode files ship no types
			await import('codemirror/mode/javascript/javascript.js');

			// @ts-expect-error -- jsonlint-mod ships no types
			const jsonlint = (await import('jsonlint-mod')) as any;

			codemirror.setOption('mode', { name: 'javascript', json: true } as ModeSpec<{ json: boolean }>);

			CodeMirror.registerHelper('lint', 'json', (text: string) => {
				const found: Record<string, any>[] = [];

				if (isInterpolation(text)) return found;

				const parser = jsonlint.parser;

				parser.parseError = (str: string, hash: any) => {
					const loc = hash.loc;

					found.push({
						from: CodeMirror.Pos(loc.first_line - 1, loc.first_column),
						to: CodeMirror.Pos(loc.last_line - 1, loc.last_column),
						message: str,
					});
				};

				if (text.length > 0) {
					try {
						jsonlint.parse(text);
					} catch {
						// Do nothing
					}
				}

				return found;
			});
		} else if (lang === 'plaintext') {
			codemirror.setOption('mode', { name: 'plaintext' });
		} else {
			await importCodemirrorMode(lang);
			codemirror.setOption('mode', { name: lang });
		}
	}
}

async function getImports(optionsObj: Record<string, any>): Promise<void> {
	const imports = [] as Promise<any>[];

	if (optionsObj && optionsObj['size'] > 0) {
		if (optionsObj['styleActiveLine']) {
			imports.push(import('codemirror/addon/selection/active-line.js'));
		}

		if (optionsObj['markSelection']) {
			imports.push(import('codemirror/addon/selection/mark-selection.js'));
		}

		if (optionsObj['highlightSelectionMatches']) {
			imports.push(import('codemirror/addon/search/match-highlighter.js'));
		}

		if (optionsObj['autoRefresh']) {
			imports.push(import('codemirror/addon/display/autorefresh.js'));
		}

		if (optionsObj['matchBrackets']) {
			imports.push(import('codemirror/addon/edit/matchbrackets.js'));
		}

		if (optionsObj['hintOptions'] || optionsObj['showHint']) {
			imports.push(import('codemirror/addon/hint/show-hint.js'));
			imports.push(import('codemirror/addon/hint/show-hint.css'));
			imports.push(import('codemirror/addon/hint/javascript-hint.js'));
		}

		await Promise.all(imports);
	}
}

const readOnly = computed(() => {
	if (width.value < 600) {
		// mobile requires 'nocursor' to avoid bringing up the keyboard
		return props.disabled ? 'nocursor' : false;
	} else {
		// desktop cannot use 'nocursor' as it prevents copy/paste
		return props.disabled;
	}
});

const defaultOptions: CodeMirror.EditorConfiguration = {
	tabSize: 4,
	autoRefresh: true,
	indentUnit: 4,
	styleActiveLine: true,
	highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true, delay: 100 },
	hintOptions: {
		completeSingle: true,
		hint: () => undefined,
	},
	matchBrackets: true,
	showCursorWhenSelecting: true,
	lineWiseCopyCut: false,
	theme: 'default',
	extraKeys: { Ctrl: 'autocomplete' },
	lint: true,
	gutters: ['CodeMirror-lint-markers'],
} as CodeMirror.EditorConfiguration;

const cmOptions = computed<Record<string, any>>(() => {
	return Object.assign(
		{},
		defaultOptions,
		{
			lineNumbers: props.lineNumber,
			lineWrapping: props.lineWrapping,
			readOnly: readOnly.value,
			cursorBlinkRate: props.disabled ? -1 : 530,
			mode: props.language || 'plaintext',
			placeholder: props.placeholder,
		},
		props.altOptions ? props.altOptions : {},
	);
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
	() => props.altOptions,
	async (altOptions) => {
		if (!altOptions || altOptions['size'] === 0) return;
		await getImports(altOptions);

		for (const key in altOptions) {
			codemirror?.setOption(key as any, altOptions[key]);
		}
	},
);

watch(
	() => props.lineNumber,
	(lineNumber) => {
		codemirror?.setOption('lineNumbers', lineNumber);
	},
);

function fillTemplate() {
	if (props.type === 'json' && props.template) {
		try {
			emit('input', JSON.parse(props.template));
		} finally {
			// Do nothing
		}
	} else {
		emit('input', props.template);
	}
}

function isInterpolation(value: any) {
	return typeof value === 'string' && value.match(INTERPOLATION_REGEX);
}

// component-specs EditorFrame and ICON_BTN.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 hover:bg-gray-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-white/5 dark:hover:text-brand-300 ${FOCUS}`;
</script>

<template>
	<div
		class="input-code bo-codemirror relative w-full overflow-hidden rounded-lg border shadow-theme-xs [&_.CodeMirror-scroll]:min-h-[9.4375rem]"
		:class="[
			{ disabled, 'non-editable': nonEditable },
			disabled
				? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]'
				: a11y?.invalid
					? 'border-error-600 bg-transparent focus-within:border-error-600 focus-within:ring-3 focus-within:ring-error-500/10 dark:border-error-400 dark:bg-gray-900'
					: 'border-gray-500 bg-transparent focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-500 dark:bg-gray-900 dark:focus-within:border-brand-400',
		]"
		dir="ltr"
	>
		<!-- An empty editor keeps the Directus min height (--input-height-md, _codemirror.scss:360). -->
		<div ref="codemirrorEl"></div>

		<template v-if="!nonEditable && template">
			<button
				v-if="disabled"
				type="button"
				class="fill-template absolute end-2 top-2 z-4"
				:class="ICON_BTN"
				disabled
				:aria-label="$t('fill_template')"
			>
				<BoIcon name="playlist_add" size="sm" />
			</button>
			<BoTooltip v-else :text="$t('fill_template')" side="left">
				<button
					type="button"
					class="fill-template absolute end-2 top-2 z-4"
					:class="ICON_BTN"
					:aria-label="$t('fill_template')"
					@click="fillTemplate"
				>
					<BoIcon name="playlist_add" size="sm" />
				</button>
			</BoTooltip>
		</template>
	</div>
</template>
