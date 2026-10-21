<!-- Ported from directus/app/src/components/v-error.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the code and message box of v-error in the error colors of the Alert recipe;
// the message also comes from an @directus/sdk error (`errors` list). The copy icon is a labelled button.
import { isPlainObject } from 'lodash-es';
import { computed, ref } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import { useClipboard } from '../../composables/use-clipboard.ts';
import { extractErrorCode } from '../../utils/extract-error-code.ts';

const props = defineProps<{
	error: Record<string, any>;
}>();

const code = computed(() => extractErrorCode(props.error));

const message = computed(() => {
	let message: string =
		props.error?.['errors']?.[0]?.message ||
		props.error?.['response']?.data?.errors?.[0]?.message ||
		props.error?.['message'] ||
		'';

	if (message.length > 200) {
		message = message.substring(0, 197) + '...';
	}

	return message;
});

const copied = ref(false);

const { isCopySupported, copyToClipboard } = useClipboard();

async function copyError() {
	const error = props.error?.['response']?.data || props.error;

	const isCopied = await copyToClipboard(
		JSON.stringify(error, isPlainObject(error) ? null : Object.getOwnPropertyNames(error), 2),
	);

	if (!isCopied) return;
	copied.value = true;
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="flex max-h-[50vh] items-start gap-3 overflow-auto rounded-lg bg-error-50 px-3 py-1 font-mono text-theme-sm text-error-700 dark:bg-error-500/15 dark:text-error-400"
	>
		<output class="min-w-0 flex-1">[{{ code }}] {{ message }}</output>
		<button
			v-if="isCopySupported"
			type="button"
			class="inline-flex shrink-0 cursor-pointer rounded"
			:class="FOCUS"
			:aria-label="$t('copy_details')"
			:title="$t('copy_details')"
			@click="copyError"
		>
			<BoIcon :name="copied ? 'check' : 'content_copy'" size="sm" />
		</button>
	</div>
</template>
