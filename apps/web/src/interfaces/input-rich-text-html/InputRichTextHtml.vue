<!-- Ported from directus/app/src/interfaces/input-rich-text-html/input-rich-text-html.vue -->
<script setup lang="ts">
// Backoffice: EditorFrame recipe (BoEditorFrame: FIELD border and focus ring, the softLength counter under the frame)
// around TinyMCE 6.8.6 self-hosted (ES imports, no CDN or API key), its UI on the theme tokens (tinymce-overrides.css)
// and its content CSS from get-editor-styles.ts. The link dialog is a BoDialog (a form: Enter saves), the source code,
// image and media drawers are BoDrawers (media: BoTabs instead of the drawer sidebar tabs), the image and media
// uploads a BoUpload with its files drawer (DrawerFiles). Not ported: v-prevent-focusout and the focus trap pause
// (Reka dialogs are portals that keep the focus), useFocusin and the `.focus` class (the frame uses focus-within).
// tinymce.addI18n runs before the editor starts (DR: onMounted, after the child editor began its init) so
// TinyMCE never requests a language file. The editor iframe is labelled by the form label (FORM_FIELD_A11Y, FR-094).
// shortcut: TinyMCE's own menus and dialogs (style formats, table) open in a sink on <body>; inside a drawer, Reka's
// modal focus scope and outside-click dismissal do not know that sink, so use them outside drawers until BoDrawer
// learns to ignore `.tox` elements.
import type { SettingsStorageAssetPreset } from '@directus/types';
import Editor from '@tinymce/tinymce-vue';
import { cloneDeep, isEqual } from 'lodash-es';
import tinymce from 'tinymce/tinymce.js';
import { computed, inject, ref, toRefs, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoCheckbox from '../../components/BoCheckbox.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoEditorFrame from '../../components/BoEditorFrame.vue';
import BoInput from '../../components/BoInput.vue';
import BoSelect from '../../components/BoSelect.vue';
import BoTabs from '../../components/BoTabs.vue';
import BoTextarea from '../../components/BoTextarea.vue';
import BoDrawer from '../../components/drawers/BoDrawer.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseGlobalMimeTypeAllowList } from '../../composables/use-mime-type-filter.ts';
import { i18n } from '../../lang/index.ts';
import { useServerStore } from '../../stores/server.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import InterfaceInputCode from '../input-code/InputCode.vue';
import getEditorStyles from './get-editor-styles.ts';
import toolbarDefault from './toolbar-default.ts';
import useImage from './useImage.ts';
import useInlineCode from './useInlineCode.ts';
import useLink from './useLink.ts';
import useMedia from './useMedia.ts';
import usePre from './usePre.ts';
import useSourceCode from './useSourceCode.ts';

import 'tinymce/skins/ui/oxide/skin.css';
import './tinymce-overrides.css';

import 'tinymce/icons/default/icons.js';
import 'tinymce/models/dom/model.js';
import 'tinymce/plugins/autoresize/plugin.js';
import 'tinymce/plugins/code/plugin.js';
import 'tinymce/plugins/directionality/plugin.js';
import 'tinymce/plugins/fullscreen/plugin.js';
import 'tinymce/plugins/image/plugin.js';
import 'tinymce/plugins/insertdatetime/plugin.js';
import 'tinymce/plugins/link/plugin.js';
import 'tinymce/plugins/lists/plugin.js';
import 'tinymce/plugins/media/plugin.js';
import 'tinymce/plugins/pagebreak/plugin.js';
import 'tinymce/plugins/preview/plugin.js';
import 'tinymce/plugins/table/plugin.js';
import 'tinymce/themes/silver/theme.js';

type CustomFormat = {
	title: string;
	inline: string;
	classes: string;
	styles: Record<string, string>;
	attributes: Record<string, string>;
};

const props = withDefaults(
	defineProps<{
		value: string | null;
		toolbar?: string[];
		font?: 'sans-serif' | 'serif' | 'monospace';
		customFormats?: CustomFormat[];
		tinymceOverrides?: Record<string, unknown> | undefined;
		disabled?: boolean;
		nonEditable?: boolean;
		imageToken?: string | undefined;
		folder?: string | undefined;
		softLength?: number | undefined;
		direction?: string | undefined;
	}>(),
	{
		toolbar: () => toolbarDefault,
		font: 'sans-serif',
		customFormats: () => [],
		tinymceOverrides: undefined,
		imageToken: undefined,
		folder: undefined,
		softLength: undefined,
		direction: undefined,
	},
);

const emit = defineEmits(['input']);

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);
const counterId = useId();

const editorRef = ref<any | null>(null);
const comparisonEditorRef = ref<any | null>(null);
const comparisonEditorInitialized = ref(false);
const editorKey = ref(0);

const { imageToken } = toRefs(props);
const settingsStore = useSettingsStore();
const { info } = useServerStore();
const allowedMimeTypes = computed(() => parseGlobalMimeTypeAllowList(info.files?.mimeTypeAllowList)?.join(','));

const storageAssetTransform = ref('all');
const storageAssetPresets = ref<SettingsStorageAssetPreset[]>([]);

if (settingsStore.settings?.['storage_asset_transform']) {
	storageAssetTransform.value = settingsStore.settings['storage_asset_transform'] as string;
	storageAssetPresets.value = (settingsStore.settings['storage_asset_presets'] as SettingsStorageAssetPreset[]) ?? [];
}

const count = ref(0);

const { imageDrawerOpen, imageSelection, closeImageDrawer, onImageSelect, saveImage, imageButton } = useImage(
	editorRef,
	imageToken,
	{
		storageAssetTransform,
		storageAssetPresets,
	},
);

const {
	mediaDrawerOpen,
	mediaSelection,
	closeMediaDrawer,
	openMediaTab,
	onMediaSelect,
	embed,
	saveMedia,
	mediaHeight,
	mediaWidth,
	mediaSource,
	mediaButton,
} = useMedia(editorRef, imageToken);

const { linkButton, linkDrawerOpen, closeLinkDrawer, saveLink, linkSelection, isLinkSaveable } = useLink(editorRef);

const { codeDrawerOpen, code, closeCodeDrawer, saveCode, sourceCodeButton } = useSourceCode(editorRef);

const { preButton } = usePre(editorRef);
const { inlineCodeButton } = useInlineCode(editorRef);

const internalValue = computed({
	get() {
		return props.value || '';
	},
	set(value) {
		if (props.value !== value) {
			contentUpdated();
		}
	},
});

const editorInitialized = ref(false);

const editorDisabled = computed(() => {
	if (!editorInitialized.value) return false;

	return props.disabled;
});

watch(
	() => [props.direction, editorRef],
	() => {
		if (editorRef.value) {
			if (props.direction === 'rtl') {
				editorRef.value.editorCommands?.commands?.exec?.mcedirectionrtl();
			} else {
				editorRef.value.editorCommands?.commands?.exec?.mcedirectionltr();
			}
		}
	},
);

watch(
	() => [props.toolbar, props.font, props.customFormats, props.tinymceOverrides],
	(newOptions, oldOptions) => {
		if (isEqual(newOptions, oldOptions)) return;

		editorRef.value.remove();
		editorInitialized.value = false;
		editorKey.value++;
	},
);

watch(
	() => [props.value, props.font, props.direction],
	() => {
		if (comparisonEditorRef.value && comparisonEditorInitialized.value) {
			comparisonEditorRef.value.setContent(props.value || '');
		}
	},
);

function getBaseEditorOptions() {
	return {
		skin: false,
		body_class: props.nonEditable ? 'non-editable' : '',
		content_css: false,
		branding: false,
		max_height: 1000,
		elementpath: false,
		statusbar: false,
		menubar: false,
		convert_urls: false,
		directionality: props.direction,
		language: i18n.global.locale.value,
	};
}

function mapToolbarButton(button: string): string {
	const buttonMap: Record<string, string> = {
		link: 'customLink',
		media: 'customMedia',
		code: 'customCode',
		image: 'customImage',
		pre: 'customPre',
		inlinecode: 'customInlineCode',
	};

	return buttonMap[button] || button;
}

const editorOptions = computed(() => {
	const styleFormats =
		Array.isArray(props.customFormats) && props.customFormats.length > 0 ? cloneDeep(props.customFormats) : null;

	let toolbarString = (props.toolbar ?? []).map(mapToolbarButton).join(' ');

	if (styleFormats) {
		toolbarString += ' styles';
	}

	return {
		...getBaseEditorOptions(),
		content_style: getEditorStyles(props.font as 'sans-serif' | 'serif' | 'monospace'),
		plugins: [
			'media',
			'table',
			'lists',
			'image',
			'link',
			'pagebreak',
			'code',
			'insertdatetime',
			'autoresize',
			'preview',
			'fullscreen',
			'directionality',
		],
		image_dimensions: false,
		extended_valid_elements: 'audio[loop|controls],source[src|type]',
		toolbar: toolbarString ? toolbarString : false,
		style_formats: styleFormats,
		file_picker_types: 'customImage customMedia image media',
		link_default_protocol: 'https',
		browser_spellcheck: true,
		paste_data_images: false,
		setup,
		ui_mode: 'split',
		...(props.tinymceOverrides && cloneDeep(props.tinymceOverrides)),
	};
});

const comparisonEditorOptions = computed(() => {
	return {
		...getBaseEditorOptions(),
		content_style: getEditorStyles(props.font as 'sans-serif' | 'serif' | 'monospace', true),
		plugins: ['autoresize', 'directionality'],
		toolbar: false,
		readonly: true,
		setup: (editor: any) => {
			comparisonEditorRef.value = editor;

			editor.on('init', () => {
				comparisonEditorInitialized.value = true;
				editor.setContent(props.value || '');
				linkIframe(editor);
			});
		},
	};
});

let observer: MutationObserver;
let emittedValue: any;

function setCount() {
	const iframeContents = editorRef.value?.contentWindow.document.getElementById('tinymce');
	count.value = iframeContents?.textContent?.replace('\n', '')?.length ?? 0;
}

function contentUpdated() {
	setCount();

	if (!observer) return;

	const newValue = editorRef.value.getContent() || null;

	if (newValue === emittedValue) return;

	emittedValue = newValue;
	emit('input', newValue);
}

function setupContentWatcher() {
	if (observer) return;

	const iframeContents = editorRef.value.contentWindow.document.getElementById('tinymce');

	observer = new MutationObserver((_mutations) => {
		contentUpdated();
	});

	const config = { characterData: true, childList: true, subtree: true };
	observer.observe(iframeContents, config);
}

function setup(editor: any) {
	editorRef.value = editor;

	const linkShortcut = 'meta+k';

	editor.ui.registry.addToggleButton('customPre', preButton);
	editor.ui.registry.addToggleButton('customImage', imageButton);
	editor.ui.registry.addToggleButton('customMedia', mediaButton);
	editor.ui.registry.addToggleButton('customLink', { ...linkButton, shortcut: linkShortcut });

	editor.ui.registry.addToggleButton('customInlineCode', inlineCodeButton);
	editor.ui.registry.addButton('customCode', sourceCodeButton);

	editor.on('init', function () {
		editor.shortcuts.remove(linkShortcut);

		editor.addShortcut(linkShortcut, 'Insert Link', () => {
			editor.ui.registry.getAll().buttons.customlink.onAction();
		});

		setCount();
		linkIframe(editor);

		editorInitialized.value = true;
	});

	editor.on('OpenWindow', function (e: any) {
		if (e.dialog?.getData) {
			const data = e.dialog?.getData();

			if (data) {
				if (data.url) {
					e.dialog.close();
					editor.ui.registry.getAll().buttons.customlink.onAction();
				}

				if (data.src) {
					e.dialog.close();
					editor.ui.registry.getAll().buttons.customimage.onAction(true);
				}
			}
		}
	});
}

// Backoffice: the form label, help, errors and the counter reach the editor iframe (FR-094).
function linkIframe(editor: any = editorRef.value) {
	const iframe = editor?.iframeElement as HTMLIFrameElement | undefined;
	if (!iframe) return;

	const set = (name: string, value: string | undefined) =>
		value ? iframe.setAttribute(name, value) : iframe.removeAttribute(name);

	set('aria-labelledby', a11y?.value.labelId);
	set(
		'aria-describedby',
		[a11y?.value.describedBy, props.softLength ? counterId : undefined].filter(Boolean).join(' ') || undefined,
	);
	set('aria-invalid', a11y?.value.invalid ? 'true' : undefined);
}

watch([() => a11y?.value, () => props.softLength], () => linkIframe());

tinymce.addI18n(i18n.global.locale.value, {
	Undo: t('wysiwyg_options.undo'),
	Redo: t('wysiwyg_options.redo'),
	Bold: t('wysiwyg_options.bold'),
	Italic: t('wysiwyg_options.italic'),
	Underline: t('wysiwyg_options.underline'),
	Strikethrough: t('wysiwyg_options.strikethrough'),
	Subscript: t('wysiwyg_options.subscript'),
	Superscript: t('wysiwyg_options.superscript'),
	'Font {0}': `${t('wysiwyg_options.fontselect')} {0}`,
	'Font size {0}': `${t('wysiwyg_options.fontsizeselect')} {0}`,
	'Heading 1': t('wysiwyg_options.h1'),
	'Heading 2': t('wysiwyg_options.h2'),
	'Heading 3': t('wysiwyg_options.h3'),
	'Heading 4': t('wysiwyg_options.h4'),
	'Heading 5': t('wysiwyg_options.h5'),
	'Heading 6': t('wysiwyg_options.h6'),
	'Align center': t('wysiwyg_options.aligncenter'),
	'Align left': t('wysiwyg_options.alignleft'),
	'Align right': t('wysiwyg_options.alignright'),
	Justify: t('wysiwyg_options.alignjustify'),
	'No alignment': t('wysiwyg_options.alignnone'),
	'Increase indent': t('wysiwyg_options.indent'),
	'Decrease indent': t('wysiwyg_options.outdent'),
	'Numbered list': t('wysiwyg_options.numlist'),
	'Bullet list': t('wysiwyg_options.bullist'),
	'Text color {0}': `${t('wysiwyg_options.forecolor')} {0}`,
	'Background color {0}': `${t('wysiwyg_options.backcolor')} {0}`,
	'Clear formatting': t('wysiwyg_options.removeformat'),
	Cut: t('wysiwyg_options.cut'),
	Copy: t('wysiwyg_options.copy'),
	Paste: t('wysiwyg_options.paste'),
	Remove: t('wysiwyg_options.remove'),
	'Select all': t('wysiwyg_options.selectall'),
	Blockquote: t('wysiwyg_options.blockquote'),
	Fullscreen: t('wysiwyg_options.fullscreen'),
	Table: t('wysiwyg_options.table'),
	'Horizontal line': t('wysiwyg_options.hr'),
	'Visual aids': t('wysiwyg_options.visualaid'),
	'Left to right': t('left_to_right'),
	'Right to left': t('right_to_left'),
});

// Backoffice: one upload library drawer for the image and media drawers.
const upload = ref<InstanceType<typeof BoUpload>>();
const libraryOpen = ref(false);

// DR v-tabs keeps an array model; BoTabs takes the first value.
const mediaTab = computed({
	get: () => openMediaTab.value[0] ?? 'video',
	set: (value: string) => (openMediaTab.value = [value]),
});

const storageAssetPresetItems = computed(() =>
	storageAssetPresets.value.map((preset) => ({ text: preset.key ?? '', value: preset.key ?? '' })),
);
</script>

<template>
	<div class="interface-input-rich-text-html wysiwyg" :class="{ disabled }">
		<BoEditorFrame
			:disabled="!!disabled && !nonEditable"
			:invalid="!!a11y?.invalid"
			:soft-length="softLength"
			:count="count"
			:counter-id="counterId"
		>
			<Editor v-if="nonEditable" :init="comparisonEditorOptions" disabled />
			<Editor
				v-else
				:key="editorKey"
				v-model="internalValue"
				:init="editorOptions"
				:disabled="editorDisabled"
				model-events="change keydown blur focus paste ExecCommand SetContent"
				@focus="setupContentWatcher"
				@set-content="contentUpdated"
			/>
		</BoEditorFrame>

		<BoDialog
			:open="linkDrawerOpen"
			:title="t('wysiwyg_options.link')"
			@update:open="(open: boolean) => !open && closeLinkDrawer()"
		>
			<form id="bo-rich-text-link" class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveLink">
				<BoInput
					v-model="linkSelection.url"
					class="sm:col-span-2"
					:label="t('url')"
					:placeholder="t('url_placeholder')"
					autofocus
				/>
				<BoInput
					v-model="linkSelection.displayText"
					class="sm:col-span-2"
					:label="t('display_text')"
					:placeholder="t('display_text_placeholder')"
				/>
				<BoInput v-model="linkSelection.title" :label="t('tooltip')" :placeholder="t('tooltip_placeholder')" />
				<fieldset>
					<legend class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
						{{ t('open_link_in') }}
					</legend>
					<BoCheckbox v-model="linkSelection.newTab" class="py-3" :label="t('new_tab')" />
				</fieldset>
			</form>
			<template #actions>
				<BoButton variant="secondary" @click="closeLinkDrawer">{{ t('cancel') }}</BoButton>
				<BoButton type="submit" form="bo-rich-text-link" :disabled="!isLinkSaveable">{{ t('save') }}</BoButton>
			</template>
		</BoDialog>

		<BoDrawer
			v-model="codeDrawerOpen"
			:title="t('wysiwyg_options.source_code')"
			icon="code"
			@cancel="closeCodeDrawer"
			@apply="saveCode"
		>
			<InterfaceInputCode :value="code" language="htmlmixed" line-wrapping @input="code = $event" />

			<template #actions>
				<BoButton icon="check" :aria-label="t('save')" @click="saveCode" />
			</template>
		</BoDrawer>

		<BoDrawer
			v-model="imageDrawerOpen"
			:title="t('wysiwyg_options.image')"
			icon="image"
			@cancel="closeImageDrawer"
			@apply="saveImage"
		>
			<template v-if="imageSelection">
				<img class="image-preview mb-6 h-20 w-full rounded-lg object-cover" :src="imageSelection.previewUrl" alt="" />
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<BoInput v-model="imageSelection.imageUrl" :label="t('image_url')" />
					<BoInput v-model="imageSelection.alt" :label="t('alt_text')" />
					<template v-if="storageAssetTransform === 'all'">
						<BoInput
							:model-value="imageSelection.width ?? null"
							:label="t('width')"
							:disabled="!!imageSelection.transformationKey"
							@update:model-value="imageSelection.width = $event as never"
						/>
						<BoInput
							:model-value="imageSelection.height ?? null"
							:label="t('height')"
							:disabled="!!imageSelection.transformationKey"
							@update:model-value="imageSelection.height = $event as never"
						/>
					</template>
					<fieldset>
						<legend class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
							{{ t('wysiwyg_options.lazy_loading') }}
						</legend>
						<BoCheckbox v-model="imageSelection.lazy" class="py-3" :label="t('wysiwyg_options.lazy_loading_label')" />
					</fieldset>
					<BoSelect
						v-if="storageAssetTransform !== 'none' && storageAssetPresets.length > 0"
						:model-value="imageSelection.transformationKey ?? null"
						:label="t('transformation_preset_key')"
						:items="storageAssetPresetItems"
						@update:model-value="imageSelection.transformationKey = $event"
					/>
				</div>
			</template>
			<BoUpload
				v-else
				ref="upload"
				:multiple="false"
				from-library
				from-url
				:folder="folder"
				:accept="allowedMimeTypes"
				@input="onImageSelect($event as never)"
				@library="libraryOpen = true"
			/>

			<template #actions>
				<BoButton icon="check" :aria-label="t('save_image')" @click="saveImage" />
			</template>
		</BoDrawer>

		<BoDrawer
			v-model="mediaDrawerOpen"
			:title="t('wysiwyg_options.media')"
			icon="slideshow"
			@cancel="closeMediaDrawer"
			@apply="saveMedia"
		>
			<BoTabs
				v-model="mediaTab"
				:items="[
					{ value: 'video', label: t('media') },
					{ value: 'embed', label: t('embed') },
				]"
				:label="t('wysiwyg_options.media')"
			>
				<template #content="{ item }">
					<template v-if="item.value === 'video'">
						<template v-if="mediaSelection">
							<video
								v-if="mediaSelection.tag !== 'iframe'"
								class="media-preview mb-6 h-20 w-full rounded-lg object-cover"
								controls
							>
								<source :src="mediaSelection.previewUrl" />
							</video>
							<iframe
								v-if="mediaSelection.tag === 'iframe'"
								:title="t('interfaces.input-rich-text-html.media_preview_iframe_title')"
								class="media-preview mb-6 h-20 w-full rounded-lg"
								:src="mediaSelection.previewUrl"
							></iframe>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<BoInput v-model="mediaSource" class="sm:col-span-2" :label="t('source')" />
								<BoInput
									:model-value="mediaWidth ?? null"
									:label="t('width')"
									@update:model-value="mediaWidth = $event as never"
								/>
								<BoInput
									:model-value="mediaHeight ?? null"
									:label="t('height')"
									@update:model-value="mediaHeight = $event as never"
								/>
							</div>
						</template>
						<BoUpload
							v-else
							ref="upload"
							:multiple="false"
							from-library
							from-url
							:folder="folder"
							:accept="allowedMimeTypes"
							@input="onMediaSelect($event as never)"
							@library="libraryOpen = true"
						/>
					</template>
					<BoTextarea v-else v-model="embed" :label="t('embed')" font="monospace" />
				</template>
			</BoTabs>

			<template #actions>
				<BoButton icon="check" :aria-label="t('save_media')" @click="saveMedia" />
			</template>
		</BoDrawer>

		<DrawerFiles
			:active="libraryOpen"
			:folder="folder"
			@update:active="libraryOpen = $event"
			@input="upload?.setSelection($event)"
		/>
	</div>
</template>
