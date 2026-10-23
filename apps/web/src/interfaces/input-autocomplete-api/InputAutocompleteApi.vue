<!-- Ported from directus/app/src/interfaces/input-autocomplete-api/input-autocomplete-api.vue -->
<script setup lang="ts">
// Backoffice: VMenu + VInput + VList are BoCombobox (component-specs Combobox, `ignore-filter`: the API filters).
// Requests (FR-023, contracts/api-calls #43): a URL starting with "/" goes through apiFetch (session, API base URL,
// like the DR `api` axios instance); any other URL is fetched directly with `credentials: 'omit'` and no session
// header (DR uses a bare axios). iconLeft is the combobox prepend, iconRight sits over the end of the input;
// `font` maps to the theme font classes.
import { debounce, get, throttle } from 'lodash-es';
import { render } from 'micromustache';
import { computed, inject, ref } from 'vue';
import { apiFetch } from '../../api/sdk.ts';
import BoCombobox from '../../components/BoCombobox.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoNotice from '../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';

const props = withDefaults(
	defineProps<{
		value: string | number | null;
		url?: string | undefined;
		resultsPath?: string | undefined;
		textPath?: string | undefined;
		valuePath?: string | undefined;
		trigger?: 'debounce' | 'throttle';
		rate?: number | string;
		placeholder?: string | undefined;
		iconLeft?: string | undefined;
		iconRight?: string | undefined;
		font?: 'sans-serif' | 'serif' | 'monospace';
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
		direction?: string | undefined;
	}>(),
	{
		trigger: 'throttle',
		rate: 500,
		font: 'sans-serif',
	},
);

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const results = ref<Record<string, any>[]>([]);

const fetchResultsRaw = async (value: string | null) => {
	if (!value) {
		results.value = [];
		return;
	}

	const url = render(props.url!, { value });

	try {
		// Backoffice: fetch instead of axios; a non-2xx answer throws like axios does.
		const response = await (url.startsWith('/') ? apiFetch(url) : fetch(url, { credentials: 'omit' }));
		if (!response.ok) throw new Error(`Request failed with status code ${response.status}`);
		const result = { data: await response.json() };
		const resultsArray = props.resultsPath ? get(result.data, props.resultsPath) : result.data;

		if (Array.isArray(resultsArray) === false) {
			// eslint-disable-next-line no-console
			console.warn(`Expected results type of array, "${typeof resultsArray}" received`);
			return;
		}

		results.value = resultsArray.map((result: Record<string, unknown>) => {
			if (props.textPath && props.valuePath) {
				return { text: get(result, props.textPath), value: get(result, props.valuePath) };
			} else if (props.valuePath) {
				return { value: get(result, props.valuePath) };
			} else {
				return { value: result };
			}
		});
	} catch (err: any) {
		// eslint-disable-next-line no-console
		console.warn(err);
	}
};

const fetchResults =
	props.trigger === 'debounce'
		? debounce(fetchResultsRaw, Number(props.rate))
		: throttle(fetchResultsRaw, Number(props.rate));

// Backoffice: listens to the native input event (user typing) that bubbles out of BoCombobox, not to its
// `update:search`, which also fires when Reka writes the display value (mount, selection).
function onInput(event: Event) {
	const value = (event.target as HTMLInputElement).value;
	// VInput is nullable by default, so an emptied input emits null.
	emitValue(value === '' ? null : value);
	return fetchResults(value);
}

function emitValue(value: unknown) {
	emit('input', value);
}

const items = computed(() =>
	results.value.map((result) => ({
		text: String(props.textPath ? result['text'] : result['value']),
		value: result['value'],
	})),
);

// shortcut: the theme only defines font-outfit; serif and monospace use generic system stacks (as BoTextarea) until
// the design-system adds font tokens for them.
const FONTS = {
	'sans-serif': 'font-outfit',
	serif: 'font-[family-name:ui-serif,Georgia,serif]',
	monospace: 'font-[family-name:ui-monospace,SFMono-Regular,Menlo,monospace]',
};
</script>

<template>
	<BoNotice v-if="!url" type="warning">
		{{ $t('one_or_more_options_are_missing') }}
	</BoNotice>
	<div v-else :dir="direction" :class="FONTS[font]">
		<BoCombobox
			:id="a11y?.inputId"
			:aria-describedby="a11y?.describedBy"
			:invalid="!!a11y?.invalid"
			:model-value="value"
			:items="items"
			ignore-filter
			:placeholder="placeholder ?? ''"
			:disabled="!!disabled"
			@input="onInput"
			@update:model-value="emitValue"
		>
			<template v-if="iconLeft" #prepend>
				<BoIcon data-icon-left :name="iconLeft" />
			</template>
			<template v-if="iconRight" #append>
				<BoIcon data-icon-right :name="iconRight" />
			</template>
		</BoCombobox>
	</div>
</template>
