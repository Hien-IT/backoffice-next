<!-- Ported from directus/app/src/interfaces/input-block-editor/input-block-editor.vue -->
<script setup lang="ts">
// Backoffice: EditorFrame recipe (BoEditorFrame when `bordered`) with the Editor.js overrides on the theme tokens;
// `api.defaults.baseURL` -> getApiUrl() (fileURL/url of the file tools, R7); the upload drawer is a BoDrawer with
// BoUpload and its files drawer (DrawerFiles). "Open Image" (bus `open-url`) goes to the file route of the app for an
// API `files/<id>` URL. The editor holder is a group labelled by the form label (FORM_FIELD_A11Y, FR-094).
import EditorJS from '@editorjs/editorjs';
import { isEqual } from 'lodash-es';
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { getApiUrl } from '../../api/sdk.ts';
import BoEditorFrame from '../../components/BoEditorFrame.vue';
import BoDrawer from '../../components/drawers/BoDrawer.vue';
import DrawerFiles from '../../components/drawers/DrawerFiles.vue';
import BoUpload from '../../components/files/BoUpload.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { parseGlobalMimeTypeAllowList } from '../../composables/use-mime-type-filter.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useServerStore } from '../../stores/server.ts';
import { useBus } from './bus.ts';
import { sanitizeValue } from './sanitize.ts';
import getTools from './tools.ts';
import { useFileHandler } from './use-file-handler.ts';

import './editorjs-overrides.css';

// https://github.com/codex-team/editor.js/blob/057bf17a6fc2d5e05c662107918d7c3e943d077c/src/components/events/RedactorDomChanged.ts#L4
const RedactorDomChanged = 'redactor dom changed';

function unexpectedError(error: unknown): void {
	// eslint-disable-next-line no-console
	console.warn(error);
}

const props = withDefaults(
	defineProps<{
		disabled?: boolean;
		nonEditable?: boolean;
		autofocus?: boolean;
		value?: Record<string, any> | null;
		bordered?: boolean;
		placeholder?: string | undefined;
		tools?: string[];
		folder?: string | undefined;
		font?: 'sans-serif' | 'monospace' | 'serif';
	}>(),
	{
		value: null,
		bordered: true,
		placeholder: undefined,
		folder: undefined,
		tools: () => ['header', 'nestedlist', 'code', 'image', 'paragraph', 'checklist', 'quote', 'underline'],
		font: 'sans-serif',
	},
);

const bus = useBus();

const emit = defineEmits<{ input: [value: EditorJS.OutputData | null] }>();

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const collectionStore = useCollectionsStore();
const { info } = useServerStore();
const allowedMimeTypes = computed(() => parseGlobalMimeTypeAllowList(info.files?.mimeTypeAllowList)?.join(','));

const { currentPreview, setCurrentPreview, fileHandler, setFileHandler, unsetFileHandler, handleFile } =
	useFileHandler();

const editorjsRef = ref<EditorJS>();
const editorjsIsReady = ref(false);
// Backoffice: set on unmount; destroy() empties the Editor.js instance, so a mount still starting must stop (DR
// throws "editorjsRef.value.on is not a function" when the form closes before Editor.js is ready).
let unmounted = false;
const uploaderComponentElement = ref<InstanceType<typeof BoUpload>>();
const editorElement = ref<HTMLElement>();
const haveFilesAccess = Boolean(collectionStore.getCollection('directus_files'));
const haveValuesChanged = ref(false);
const router = useRouter();
const libraryOpen = ref(false);

const tools = getTools(
	{
		baseURL: getApiUrl(),
		setFileHandler,
		setCurrentPreview,
		getUploadFieldElement: () => uploaderComponentElement,
	},
	props.tools,
	haveFilesAccess,
);

bus.on(async (event) => {
	if (event.type === 'open-url') {
		// Backoffice: the payload is the API URL of the file; the app route is `/files/<id>` as in DR.
		router.push(event.payload.startsWith(getApiUrl()) ? '/' + event.payload.slice(getApiUrl().length) : event.payload);
	}
});

onMounted(async () => {
	editorjsRef.value = new EditorJS({
		logLevel: 'ERROR' as EditorJS.LogLevels,
		holder: editorElement.value!,
		// Do not set readOnly to true here — see the watcher below
		readOnly: false,
		placeholder: props.placeholder ?? false,
		minHeight: 72,
		onChange: (api) => emitValue(api),
		tools: tools as NonNullable<EditorJS.EditorConfig['tools']>,
	});

	await editorjsRef.value.isReady;
	if (unmounted) return;

	const sanitizedValue = sanitizeValue(props.value);

	if (sanitizedValue) {
		await editorjsRef.value.render(sanitizedValue);
		if (unmounted) return;
	}

	if (props.autofocus) {
		editorjsRef.value.focus();
	}

	editorjsRef.value.on(RedactorDomChanged, () => {
		emitValue(editorjsRef.value!);
	});

	editorjsIsReady.value = true;
});

onUnmounted(() => {
	unmounted = true;

	if (typeof editorjsRef.value?.destroy === 'function') {
		editorjsRef.value.destroy();
	}

	bus.reset();
});

watch(
	[editorjsIsReady, () => props.disabled],
	async ([isReady, isDisabled]) => {
		if (!isReady) return;

		// Note: EditorJS must be ready before readOnly is toggled; otherwise, the content won’t render, which could result in data loss!
		await nextTick();
		editorjsRef.value?.readOnly.toggle(isDisabled);
	},
	{ immediate: true },
);

watch(
	() => props.value,
	async (newVal, oldVal) => {
		// First value will be set in 'onMounted'
		if (!editorjsRef.value || !editorjsIsReady.value) return;

		// During refresh, item is temporarily null and the field is disabled — skip to avoid clearing the editor
		if (newVal === null && props.disabled) return;

		if (haveValuesChanged.value) {
			haveValuesChanged.value = false;
			return;
		}

		if (isEqual(newVal?.['blocks'], oldVal?.['blocks'])) return;

		try {
			const sanitizedValue = sanitizeValue(newVal);

			if (sanitizedValue) {
				await editorjsRef.value.render(sanitizedValue);
			} else {
				editorjsRef.value.clear();
			}
		} catch (error) {
			unexpectedError(error);
		}
	},
);

async function emitValue(context: EditorJS.API | EditorJS) {
	if (props.disabled || !context || !context.saver) return;

	try {
		const result = await context.saver.save();

		haveValuesChanged.value = true;

		if (!result || result.blocks.length < 1) {
			emit('input', null);
			return;
		}

		if (isEqual(result.blocks, props.value?.['blocks'])) return;

		emit('input', result);
	} catch (error) {
		unexpectedError(error);
	}
}

// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as the input
// interface) until the design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'font-outfit',
	serif: 'font-[family-name:ui-serif,Georgia,serif]',
	monospace: 'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
};
</script>

<template>
	<div class="input-block-editor">
		<component
			:is="bordered ? BoEditorFrame : 'div'"
			v-bind="bordered ? { disabled: disabled && !nonEditable, invalid: a11y?.invalid } : {}"
		>
			<div
				ref="editorElement"
				class="editor rounded-lg px-[1.8125rem] py-3 text-sm text-gray-800 dark:text-white/90"
				:class="[
					FONTS[font] ?? FONTS['sans-serif'],
					{ disabled, 'non-editable': nonEditable, bordered },
					disabled ? 'pointer-events-none' : '',
					disabled && !nonEditable ? 'text-gray-500 dark:text-gray-400' : '',
				]"
				role="group"
				:aria-labelledby="a11y?.labelId"
				:aria-describedby="a11y?.describedBy"
				:aria-invalid="a11y?.invalid || undefined"
			></div>
		</component>

		<template v-if="haveFilesAccess && !disabled">
			<BoDrawer
				:model-value="fileHandler !== null"
				icon="image"
				:title="t('upload_from_device')"
				cancelable
				@update:model-value="unsetFileHandler"
				@cancel="unsetFileHandler"
			>
				<div class="uploader-drawer-content space-y-4 p-6">
					<div v-if="currentPreview" class="uploader-preview-image rounded-lg bg-gray-100 dark:bg-white/5">
						<img :src="currentPreview" alt="" class="mx-auto block max-h-[40vh] max-w-full object-contain" />
					</div>
					<BoUpload
						ref="uploaderComponentElement"
						:multiple="false"
						:folder="folder"
						from-library
						from-url
						:accept="allowedMimeTypes"
						@input="handleFile($event as never)"
						@library="libraryOpen = true"
					/>
				</div>
			</BoDrawer>

			<DrawerFiles
				:active="libraryOpen"
				:folder="folder"
				@update:active="libraryOpen = $event"
				@input="uploaderComponentElement?.setSelection($event)"
			/>
		</template>
	</div>
</template>
