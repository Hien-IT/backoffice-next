<script setup lang="ts">
// Backoffice (spec 031, D-212, contracts/web.md): the Upload extension dialog of Settings > Extensions. One .tgz/.tar.gz
// file, picked with the button (the file input itself is hidden, as in BoUpload) or dropped on the zone; checked here for
// type, emptiness and the size limit of the API, then sent; the API's reason shows in the dialog. Every text that comes
// from the package (name, reason) is a text binding.
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoIcon from '../../../../../components/BoIcon.vue';
import BoNotice from '../../../../../components/BoNotice.vue';
import { useExtensionUpload } from '../../../../../composables/use-extension-upload.ts';
import { notify } from '../../../../../composables/use-notices.ts';
import { translateAPIError } from '../../../../../lang/index.ts';
import { useExtensionsStore } from '../../../../../stores/extensions.ts';

const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n();
const extensionsStore = useExtensionsStore();
const { maxUploadSize, upload } = useExtensionUpload();

const id = useId();
const input = ref<HTMLInputElement>();
const file = ref<File | null>(null);
const localError = ref<string | null>(null);
const apiError = ref<unknown>(null);
const busy = ref(false);
const dragging = ref(false);

const ACCEPT = '.tgz,.tar.gz,application/gzip,application/x-gzip';

const formatSize = (bytes: number) =>
	bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const errorText = computed(() => {
	if (localError.value) return localError.value;
	if (!apiError.value) return null;
	const e = apiError.value as { errors?: { extensions?: { reason?: string } }[] };
	return e.errors?.[0]?.extensions?.reason ?? translateAPIError(apiError.value as never);
});

function choose(picked: File | undefined | null) {
	apiError.value = null;
	localError.value = null;
	file.value = null;

	if (!picked) return;

	if (!/\.(tgz|tar\.gz)$/i.test(picked.name)) {
		localError.value = t('upload_extension_wrong_type');
	} else if (picked.size === 0) {
		localError.value = t('files_are_empty', { files: `"${picked.name}"` });
	} else if (maxUploadSize.value !== null && picked.size > maxUploadSize.value) {
		localError.value = t('upload_extension_too_large', { max: formatSize(maxUploadSize.value) });
	} else {
		file.value = picked;
	}
}

function onDrop(event: DragEvent) {
	dragging.value = false;
	if (!busy.value) choose(event.dataTransfer?.files?.[0]);
}

function onInput(event: Event) {
	const target = event.target as HTMLInputElement;
	choose(target.files?.[0]);
	target.value = '';
}

async function submit() {
	if (!file.value || busy.value) return;
	busy.value = true;
	apiError.value = null;

	try {
		const installed = await upload(file.value);
		await extensionsStore.refresh();
		notify({ title: t('upload_extension_success', { name: installed.schema?.name ?? file.value.name }), type: 'success' });
		close();
	} catch (err) {
		apiError.value = err;
	} finally {
		busy.value = false;
	}
}

function close() {
	open.value = false;
	file.value = null;
	localError.value = null;
	apiError.value = null;
}

// No closing while the package is being sent (Esc or an outside click would leave the request running unseen).
function onOpen(value: boolean) {
	if (!value && busy.value) return;
	if (!value) close();
	else open.value = true;
}
</script>

<template>
	<BoDialog
		:open="open"
		:title="$t('upload_extension')"
		:description="$t('upload_extension_copy')"
		persistent
		@update:open="onOpen"
	>
		<form :id="`${id}-form`" @submit.prevent="submit">
			<div
				data-dropzone
				class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors motion-reduce:transition-none"
				:class="
					dragging
						? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/[0.12]'
						: errorText
							? 'border-error-600 bg-gray-50 dark:border-error-400 dark:bg-white/[0.03]'
							: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03]'
				"
				:aria-busy="busy || undefined"
				@dragenter.prevent="dragging = true"
				@dragover.prevent
				@dragleave.prevent="dragging = false"
				@drop.stop.prevent="onDrop"
			>
				<BoIcon name="upload_file" size="lg" class="text-gray-500 dark:text-gray-400" />
				<BoButton variant="secondary" icon="folder_open" :disabled="busy" @click="input?.click()">
					{{ $t('upload_extension_browse') }}
				</BoButton>
				<input
					ref="input"
					class="sr-only"
					type="file"
					tabindex="-1"
					aria-hidden="true"
					:accept="ACCEPT"
					:disabled="busy"
					data-testid="extension-upload-input"
					@change="onInput"
				/>
				<p class="text-sm text-gray-700 dark:text-gray-400">{{ $t('upload_extension_drop') }}</p>
				<p
					v-if="file"
					class="text-theme-sm font-medium wrap-anywhere text-gray-800 dark:text-white/90"
					data-testid="extension-upload-file"
				>
					{{ file.name }} ({{ formatSize(file.size) }})
				</p>
			</div>

			<BoNotice v-if="errorText" type="danger" class="mt-4">{{ errorText }}</BoNotice>
		</form>

		<template #actions>
			<BoButton variant="secondary" :disabled="busy" @click="close">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" :form="`${id}-form`" icon="upload" :loading="busy" :disabled="!file || busy">
				{{ $t('upload_extension_submit') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
