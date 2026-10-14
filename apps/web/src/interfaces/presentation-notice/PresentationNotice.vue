<!-- Ported from directus/app/src/interfaces/presentation-notice/presentation-notice.vue -->
<script setup lang="ts">
// Backoffice: v-notice is BoNotice (Alert recipe) with role note (a static note, not a live status); v-md is
// utils/markdown.ts (DOMPurify, FR-065).
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import BoNotice from '../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { md } from '../../utils/markdown.ts';

const props = withDefaults(
	defineProps<{
		color?: string;
		icon?: string;
		text?: string;
	}>(),
	{
		color: 'normal',
		icon: 'info',
	},
);

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

// v-notice falls back to its normal look for an unknown type.
const TYPES = ['normal', 'info', 'success', 'warning', 'danger'] as const;
const type = computed(() => TYPES.find((type) => type === props.color) ?? 'normal');

const html = computed(() => md(props.text ?? t('interfaces.presentation-notice.no_text')));
</script>

<template>
	<BoNotice
		:id="a11y?.inputId"
		:type="type"
		:icon="icon"
		role="note"
		:data-type="color"
		:aria-describedby="a11y?.describedBy"
	>
		<!-- sanitized by utils/markdown.ts (DOMPurify, FR-065) -->
		<!-- eslint-disable vue/no-v-html -->
		<div
			class="[&_a]:text-brand-500 [&_a]:underline [&_a:hover]:text-brand-600 dark:[&_a]:text-brand-400 [&_p:not(:last-child)]:mb-2"
			v-html="html"
		/>
		<!-- eslint-enable vue/no-v-html -->
	</BoNotice>
</template>
