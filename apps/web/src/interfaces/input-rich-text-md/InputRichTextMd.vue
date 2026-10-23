<!-- Ported from directus/app/src/interfaces/input-rich-text-md/input-rich-text-md.vue -->
<script setup lang="ts">
// Backoffice: EditorFrame recipe (BoEditorFrame: FIELD border, Reka toolbar with one Tab stop, the softLength counter
// under the frame) with CodeMirror colors from codemirror-theme.css; the heading menu is a BoMenu, the table menu a
// Reka Popover, the edit/preview switch a toolbar toggle group; the image dialog is a BoDialog with BoUpload and its
// files drawer (DrawerFiles). Shortcuts are a keydown handler on the interface (useShortcut of @directus/composables
// also fires when the page body has focus) and do nothing while disabled or in preview. The counter counts the
// rendered preview text from the start (DR counts it only after the first preview change) and the preview is
// rendered only when shown (no hidden image requests). Label linked to CodeMirror's input (FORM_FIELD_A11Y, FR-094).
import { useWindowSize } from '@vueuse/core';
import CodeMirror from 'codemirror';
import {
	PopoverClose,
	PopoverContent,
	PopoverPortal,
	PopoverRoot,
	PopoverTrigger,
	ToolbarButton,
	ToolbarToggleGroup,
	ToolbarToggleItem,
} from 'reka-ui';
import { computed, inject, nextTick, onMounted, reactive, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoEditorFrame, { EDITOR_TOOLBAR_BUTTON } from '../../components/BoEditorFrame.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoInput from '../../components/BoInput.vue';
import BoMenu from '../../components/BoMenu.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseGlobalMimeTypeAllowList } from '../../composables/use-mime-type-filter.ts';
import { useServerStore } from '../../stores/server.ts';
import { getAssetUrl } from '../../utils/get-asset-url.ts';
import { md } from '../../utils/markdown.ts';
import { type Alteration, applyEdit, type CustomSyntax } from './edits.ts';
import { translateShortcut } from './translate-shortcut.ts';

import 'codemirror/lib/codemirror.css';
import '../../styles/codemirror-theme.css';

import 'codemirror/addon/display/placeholder.js';
import 'codemirror/mode/markdown/markdown.js';

const props = withDefaults(
	defineProps<{
		value: string | null;
		disabled?: boolean;
		nonEditable?: boolean;
		placeholder?: string | undefined;
		editorFont?: 'sans-serif' | 'serif' | 'monospace';
		previewFont?: 'sans-serif' | 'serif' | 'monospace';
		defaultView?: 'editor' | 'preview';
		toolbar?: string[];
		customSyntax?: CustomSyntax[];
		imageToken?: string | undefined;
		softLength?: number | undefined;
		folder?: string | undefined;
		direction?: string | undefined;
	}>(),
	{
		placeholder: undefined,
		imageToken: undefined,
		softLength: undefined,
		folder: undefined,
		direction: undefined,
		editorFont: 'sans-serif',
		previewFont: 'sans-serif',
		defaultView: 'editor',
		nonEditable: false,
		toolbar: () => [
			'heading',
			'bold',
			'italic',
			'strikethrough',
			'bullist',
			'numlist',
			'blockquote',
			'code',
			'link',
			'table',
			'image',
			'link',
			'empty',
		],
		customSyntax: () => [],
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();

const { info } = useServerStore();
const allowedMimeTypes = computed(() => parseGlobalMimeTypeAllowList(info.files?.mimeTypeAllowList)?.join(','));

const a11y = inject(FORM_FIELD_A11Y, null);
const editorId = useId();

const codemirrorEl = ref<HTMLDivElement>();
let codemirror: CodeMirror.Editor | null = null;
let previousContent: string | null = null;

const view = ref(props.defaultView);

const imageDialogOpen = ref(false);
const libraryOpen = ref(false);
const upload = ref<InstanceType<typeof BoUpload>>();

const counterId = useId();

const { width } = useWindowSize();

const readOnly = computed(() => {
	if (width.value < 600) {
		// mobile requires 'nocursor' to avoid bringing up the keyboard
		return props.disabled ? 'nocursor' : false;
	} else {
		// desktop cannot use 'nocursor' as it prevents copy/paste
		return props.disabled;
	}
});

onMounted(async () => {
	if (codemirrorEl.value) {
		codemirror = CodeMirror(codemirrorEl.value, {
			mode: 'markdown',
			configureMouse: () => ({ addNew: false }),
			lineWrapping: true,
			readOnly: readOnly.value,
			direction: props.direction === 'rtl' ? props.direction : 'ltr',
			cursorBlinkRate: props.disabled ? -1 : 530,
			placeholder: props.placeholder,
			value: props.value || '',
			spellcheck: true,
			inputStyle: 'contenteditable',
		} as CodeMirror.EditorConfiguration);

		linkInput();

		codemirror.on('change', (cm, { origin }) => {
			const content = cm.getValue();

			// prevent duplicate emits with same content
			if (content === previousContent) return;
			previousContent = content;

			if (origin === 'setValue') return;

			emit('input', content);
		});
	}
});

// Backoffice: the form label, help, errors and the counter reach the element CodeMirror types into (FR-094).
function linkInput() {
	const input = codemirror?.getInputField();
	if (!input) return;

	input.id = editorId;
	if (a11y) input.setAttribute('aria-labelledby', a11y.value.labelId);

	const describedBy = [a11y?.value.describedBy, props.softLength ? counterId : undefined].filter(Boolean).join(' ');
	if (describedBy) input.setAttribute('aria-describedby', describedBy);
	else input.removeAttribute('aria-describedby');

	if (a11y?.value.invalid) input.setAttribute('aria-invalid', 'true');
	else input.removeAttribute('aria-invalid');
}

watch([() => a11y?.value, () => props.softLength], linkInput);

watch(
	() => props.value,
	(newValue) => {
		if (!codemirror) return;

		const existingValue = codemirror.getValue();

		if (existingValue !== newValue) {
			codemirror.setValue('');
			codemirror.clearHistory();
			codemirror.setValue(newValue ?? '');
			codemirror.refresh();
		}
	},
);

watch(
	() => props.disabled,
	(disabled) => {
		codemirror?.setOption('readOnly', readOnly.value);
		codemirror?.setOption('cursorBlinkRate', disabled ? -1 : 530);
	},
	{ immediate: true },
);

watch(
	() => props.direction,
	(direction) => {
		codemirror?.setOption('direction', direction === 'rtl' ? direction : 'ltr');
	},
);

// Backoffice: CodeMirror is hidden with display none in preview and measures again when shown.
watch(view, async (value) => {
	if (value !== 'editor') return;
	await nextTick();
	codemirror?.refresh();
});

// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as the input
// interface) until the design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'var(--font-outfit)',
	serif: 'ui-serif, Georgia, serif',
	monospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const editFamily = computed(() => FONTS[props.editorFont] ?? FONTS['sans-serif']);

const previewFamily = computed(() => FONTS[props.previewFont] ?? FONTS['sans-serif']);

const markdownString = computed(() => {
	return props.value || '';
});

const html = computed(() => md(markdownString.value));

// The preview text length (DR counts the preview box textContent without its first line break); parsed in an
// inert document so images do not load.
const count = computed(() => {
	if (!props.softLength) return 0;
	const text = new DOMParser().parseFromString(html.value, 'text/html').body.textContent ?? '';
	return text.replace('\n', '').length;
});

const table = reactive({
	rows: 4,
	columns: 4,
});

const SHORTCUTS: Record<string, () => void> = {
	'meta+b': () => edit('bold'),
	'meta+i': () => edit('italic'),
	'meta+k': () => edit('link'),
	'meta+alt+d': () => edit('strikethrough'),
	'meta+alt+q': () => edit('blockquote'),
	'meta+alt+c': () => edit('code'),
	'meta+alt+1': () => edit('heading', { level: 1 }),
	'meta+alt+2': () => edit('heading', { level: 2 }),
	'meta+alt+3': () => edit('heading', { level: 3 }),
	'meta+alt+4': () => edit('heading', { level: 4 }),
	'meta+alt+5': () => edit('heading', { level: 5 }),
	'meta+alt+6': () => edit('heading', { level: 6 }),
};

// useShortcut: meta = Cmd or Ctrl; the key comes from `code` so Option+digit on macOS still matches.
function onKeydown(event: KeyboardEvent) {
	if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.repeat) return;
	if (props.disabled || props.nonEditable || view.value !== 'editor') return;

	const key = event.code.replace(/^(Key|Digit)/, '').toLowerCase();
	const handler = SHORTCUTS[`meta+${event.altKey ? 'alt+' : ''}${key}`];
	if (!handler) return;

	event.preventDefault();
	handler();
}

function onImageUpload(image: any) {
	if (!codemirror || !image) return;

	let url = getAssetUrl(image.id);

	if (props.imageToken) {
		url += '?access_token=' + props.imageToken;
	}

	codemirror.replaceSelection(`![${codemirror.getSelection()}](${url})`);

	imageDialogOpen.value = false;
}

function edit(type: Alteration, options?: Record<string, any>) {
	if (codemirror) {
		applyEdit(codemirror, type, options);
	}
}

const headingItems = computed(() =>
	[1, 2, 3, 4, 5, 6].map((n) => ({
		text: `${t(`wysiwyg_options.h${n}`)}  ${translateShortcut(['meta', 'alt'])} ${n}`,
		onSelect: () => edit('heading', { level: n }),
	})),
);

const buttons = computed(() =>
	[
		{ id: 'bold', icon: 'format_bold', text: t('wysiwyg_options.bold'), keys: ['meta', 'b'], run: () => edit('bold') },
		{
			id: 'italic',
			icon: 'format_italic',
			text: t('wysiwyg_options.italic'),
			keys: ['meta', 'i'],
			run: () => edit('italic'),
		},
		{
			id: 'strikethrough',
			icon: 'format_strikethrough',
			text: t('wysiwyg_options.strikethrough'),
			keys: ['meta', 'alt', 'd'],
			run: () => edit('strikethrough'),
		},
		{
			id: 'bullist',
			icon: 'format_list_bulleted',
			text: t('wysiwyg_options.bullist'),
			run: () => edit('listBulleted'),
		},
		{
			id: 'numlist',
			icon: 'format_list_numbered',
			text: t('wysiwyg_options.numlist'),
			run: () => edit('listNumbered'),
		},
		{
			id: 'blockquote',
			icon: 'format_quote',
			text: t('wysiwyg_options.blockquote'),
			keys: ['meta', 'alt', 'q'],
			run: () => edit('blockquote'),
		},
		{
			id: 'code',
			icon: 'code',
			text: t('wysiwyg_options.codeblock'),
			keys: ['meta', 'alt', 'c'],
			run: () => edit('code'),
		},
		{ id: 'link', icon: 'insert_link', text: t('wysiwyg_options.link'), keys: ['meta', 'k'], run: () => edit('link') },
	]
		.filter((button) => props.toolbar?.includes(button.id))
		.map((button) => ({
			...button,
			tooltip: button.keys ? `${button.text} - ${translateShortcut(button.keys)}` : button.text,
		})),
);

function createTable() {
	edit('table', { rows: Number(table.rows), columns: Number(table.columns) });
}

const BTN = EDITOR_TOOLBAR_BUTTON;
const VIEW_ITEM =
	'rounded-md px-2.5 py-1 text-theme-xs font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-white data-[state=on]:text-gray-800 data-[state=on]:shadow-theme-xs dark:text-gray-400 dark:hover:text-gray-300 dark:data-[state=on]:bg-gray-800 dark:data-[state=on]:text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
// Same rich text classes as presentation-header HelperText (DR `markdown` mixin).
const PROSE =
	'[&_*:not(:last-child):not(li)]:mb-4 [&_a]:text-brand-500 [&_a:hover]:underline dark:[&_a]:text-brand-400 [&_blockquote]:border-s-[3px] [&_blockquote]:border-brand-500 [&_blockquote]:ps-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:font-mono dark:[&_code]:bg-white/5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-2 dark:[&_pre]:bg-white/5 [&_td]:border [&_td]:border-gray-200 [&_td]:p-2 dark:[&_td]:border-gray-800 [&_th]:border [&_th]:border-gray-200 [&_th]:p-2 [&_th]:text-start dark:[&_th]:border-gray-800 [&_ul]:list-disc [&_ul]:ps-6 [&_code]:wrap-break-word [&_iframe]:max-w-full [&_img]:h-auto [&_video]:h-auto [&_video]:max-w-full';
</script>

<template>
	<div
		class="interface-input-rich-text-md"
		:class="[view, { disabled, 'non-editable': nonEditable }]"
		@keydown="onKeydown"
	>
		<BoEditorFrame
			:disabled="!!disabled && !nonEditable"
			:invalid="!!a11y?.invalid"
			:toolbar-label="t('interfaces.input-rich-text-html.toolbar')"
			:controls="editorId"
			:soft-length="softLength"
			:count="count"
			:counter-id="counterId"
		>
			<template #toolbar>
				<template v-if="!nonEditable && view === 'editor'">
					<BoMenu v-if="toolbar?.includes('heading')" :items="headingItems">
						<template #trigger>
							<ToolbarButton
								data-toolbar="heading"
								:class="BTN"
								:disabled="!!disabled"
								:aria-label="t('wysiwyg_options.heading')"
							>
								<BoIcon name="format_size" size="sm" />
							</ToolbarButton>
						</template>
					</BoMenu>

					<BoTooltip v-for="button in buttons" :key="button.id" :text="button.tooltip">
						<ToolbarButton
							:data-toolbar="button.id"
							:class="BTN"
							:disabled="!!disabled"
							:aria-label="button.tooltip"
							@click="button.run"
						>
							<BoIcon :name="button.icon" size="sm" />
						</ToolbarButton>
					</BoTooltip>

					<PopoverRoot v-if="toolbar?.includes('table')">
						<PopoverTrigger as-child>
							<ToolbarButton
								data-toolbar="table"
								:class="BTN"
								:disabled="!!disabled"
								:aria-label="t('wysiwyg_options.table')"
							>
								<BoIcon name="table_chart" size="sm" />
							</ToolbarButton>
						</PopoverTrigger>
						<PopoverPortal>
							<PopoverContent
								:side-offset="4"
								align="start"
								:collision-padding="8"
								class="table-options z-99999 grid w-64 grid-cols-2 gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
							>
								<BoInput v-model="table.rows" type="number" :label="t('rows')" min="1" />
								<BoInput v-model="table.columns" type="number" :label="t('columns')" min="1" />
								<PopoverClose as-child>
									<BoButton class="col-span-2" full-width @click="createTable">{{ t('create') }}</BoButton>
								</PopoverClose>
							</PopoverContent>
						</PopoverPortal>
					</PopoverRoot>

					<BoTooltip v-if="toolbar?.includes('image')" :text="t('wysiwyg_options.image')">
						<ToolbarButton
							data-toolbar="image"
							:class="BTN"
							:disabled="!!disabled"
							:aria-label="t('wysiwyg_options.image')"
							@click="imageDialogOpen = true"
						>
							<BoIcon name="insert_photo" size="sm" />
						</ToolbarButton>
					</BoTooltip>

					<BoTooltip v-for="custom in customSyntax" :key="custom.name" :text="custom.name">
						<ToolbarButton
							data-toolbar="custom"
							:class="BTN"
							:disabled="!!disabled"
							:aria-label="custom.name"
							@click="edit('custom', custom)"
						>
							<BoIcon :name="custom.icon" size="sm" />
						</ToolbarButton>
					</BoTooltip>
				</template>

				<div class="spacer grow"></div>

				<ToolbarToggleGroup
					type="single"
					class="view flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5"
					:model-value="view"
					:disabled="!!disabled && !nonEditable"
					@update:model-value="(value) => value && (view = value as 'editor' | 'preview')"
				>
					<ToolbarToggleItem value="editor" :class="VIEW_ITEM">
						{{ t('interfaces.input-rich-text-md.edit') }}
					</ToolbarToggleItem>
					<ToolbarToggleItem value="preview" :class="VIEW_ITEM">
						{{ t('interfaces.input-rich-text-md.preview') }}
					</ToolbarToggleItem>
				</ToolbarToggleGroup>
			</template>

			<template #default>
				<div
					v-show="view === 'editor'"
					ref="codemirrorEl"
					class="bo-codemirror bo-md-editor"
					:class="{ disabled: disabled && !nonEditable }"
					:style="{ '--bo-md-font': editFamily }"
				></div>
				<!-- sanitized by DOMPurify in utils/markdown.ts (FR-065) -->
				<!-- eslint-disable vue/no-v-html -->
				<div
					v-if="view === 'preview'"
					class="preview-box min-h-[200px] px-4 py-3 text-sm text-gray-800 dark:text-white/90"
					:class="PROSE"
					:style="{ fontFamily: previewFamily, direction: direction === 'rtl' ? direction : 'ltr' }"
					v-html="html"
				></div>
				<!-- eslint-enable vue/no-v-html -->
			</template>
		</BoEditorFrame>

		<BoDialog v-model:open="imageDialogOpen" :title="t('upload_from_device')">
			<BoUpload
				ref="upload"
				from-url
				from-library
				:folder="folder"
				:accept="allowedMimeTypes"
				@input="onImageUpload"
				@library="libraryOpen = true"
			/>
			<template #actions>
				<BoButton variant="secondary" @click="imageDialogOpen = false">{{ t('cancel') }}</BoButton>
			</template>
		</BoDialog>

		<DrawerFiles
			v-if="toolbar?.includes('image')"
			:active="libraryOpen"
			:folder="folder"
			@update:active="libraryOpen = $event"
			@input="upload?.setSelection($event)"
		/>
	</div>
</template>

<style>
/* Backoffice: DR scoped styles on the theme tokens (editor font, editor height, markdown mode colors). */
.bo-codemirror.bo-md-editor .CodeMirror {
	font-family: var(--bo-md-font);
	font-size: 0.875rem;
}

.bo-codemirror.bo-md-editor .CodeMirror-scroll {
	min-height: 200px;
	max-height: min(56.25rem, 80vh);
}

.bo-codemirror.bo-md-editor .CodeMirror-lines {
	padding: 0.75rem 0;
}

.bo-codemirror.bo-md-editor .cm-s-default .cm-header {
	color: var(--color-brand-600);
	font-weight: 600;
}

.bo-codemirror.bo-md-editor .cm-s-default .cm-quote {
	color: var(--color-gray-500);
	font-style: italic;
}

.dark .bo-codemirror.bo-md-editor .cm-s-default .cm-header {
	color: var(--color-brand-400);
}

.dark .bo-codemirror.bo-md-editor .cm-s-default .cm-quote {
	color: var(--color-gray-400);
}
</style>
