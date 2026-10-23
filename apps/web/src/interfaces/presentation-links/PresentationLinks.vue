<!-- Ported from directus/app/src/interfaces/presentation-links/presentation-links.vue -->
<script setup lang="ts">
// Backoffice: v-button is BoButton (link types map to its variants as in `header`: the DR info/success/warning
// button colors have no recipe); unexpectedError has no snackbar before feature 018 (D-45): the error shows as a
// BoNotice. A flow runs through useInjectRunManualFlow, which falls back to its own useFlows and emits `ran`.
import type { Item, PrimaryKey } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { pickBy } from 'lodash-es';
import { render } from 'micromustache';
import { computed, inject, ref, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import BoButton from '../../components/BoButton.vue';
import BoNotice from '../../components/BoNotice.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { useInjectRunManualFlow } from '../../composables/use-run-manual-flow.ts';
import { type APIError, translateAPIError } from '../../lang/index.ts';
import FlowDialogs from '../presentation-header/FlowDialogs.vue';

type Link = {
	icon: string;
	label: string;
	type: string;
	actionType: 'url' | 'flow';
	url?: string;
	flow?: string;
};

type ParsedLink = Omit<Link, 'url' | 'flow'> & {
	flow?: string | undefined;
	to?: string | undefined;
	href?: string | undefined;
	disabled: boolean;
};

const props = withDefaults(
	defineProps<{
		links?: Link[];
		collection: string;
		primaryKey?: PrimaryKey | undefined;
		disabled?: boolean | undefined;
		nonEditable?: boolean | undefined;
	}>(),
	{
		links: () => [],
	},
);

const emit = defineEmits(['ran']);

const { t } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);

const itemValues = inject('values', ref<Record<string, any>>({}));
const resolvedRelationalValues = ref<Record<string, any>>({});
const fetchError = ref<string | null>(null);
const { primaryKey } = toRefs(props);

watch(
	primaryKey,
	async (value) => {
		if (!value || value === '+') return;

		const relatedFieldsFromTemplates = getRelatedFieldsFromTemplates();
		if (relatedFieldsFromTemplates.length === 0) return;

		try {
			const item = await sdk.request<Item>(
				requestEndpoint(`${getEndpoint(props.collection)}/${value}`, {
					params: {
						fields: relatedFieldsFromTemplates,
					},
				}),
			);

			/*
			 * Pick only non-arrays because we can't render those types of relations.
			 * For example, a M2M relation would return an array.
			 */
			resolvedRelationalValues.value = pickBy(item, (value) => !Array.isArray(value));
		} catch (err) {
			// eslint-disable-next-line no-console
			console.warn(err);
			fetchError.value = translateAPIError(err as APIError);
		}
	},
	{ immediate: true },
);

const linksParsed = computed<ParsedLink[]>(() =>
	props.links.map((link) => {
		/*
		 * Resolve related fields for interpolation.
		 * If the values from v-form already include related fields,
		 * we use them because those represent the current unstaged edits.
		 * Otherwise we use the fetched values from the API.
		 */

		const scope = { ...itemValues.value };

		Object.keys(resolvedRelationalValues.value).forEach((key) => {
			if (scope[key]?.constructor !== Object && scope[key] !== null) {
				scope[key] = resolvedRelationalValues.value[key];
			}
		});

		const interpolatedUrl = link.url ? render(link.url, scope) : '';

		/*
		 * This incorrectly matches new links starting with two slashes but(!)
		 * updating this line would change existing behavior.
		 */
		const isInternalLink = interpolatedUrl?.startsWith('/');

		return {
			icon: link.icon,
			type: link.type,
			label: link.label,
			actionType: link.actionType,
			to: isInternalLink ? interpolatedUrl : undefined,
			href: link.actionType === 'flow' || isInternalLink ? undefined : interpolatedUrl,
			flow: link.actionType === 'flow' ? link.flow : undefined,
			disabled: isDisabled(),
		};

		function isDisabled() {
			if (props.disabled && !props.nonEditable) return true;

			return link.actionType === 'flow' && (props.nonEditable || props.primaryKey === '+');
		}
	}),
);

const { runManualFlow, runningFlows, isActiveFlow, flowDialogsContext } = useInjectRunManualFlow({
	collection: computed(() => props.collection),
	primaryKey: computed(() => props.primaryKey ?? null),
	onRefreshCallback: () => emit('ran'),
});

/**
 * Get all deduplicated relational fields from the link-templates.
 * For example:
 * [ "related.field", "languages.code" ]
 */
function getRelatedFieldsFromTemplates() {
	const allFields = props.links?.flatMap((link) => (!link.url ? [] : getFieldsFromTemplate(link.url)));

	const deduplicatedFields = [...new Set(allFields)];

	const relationalFields = deduplicatedFields.filter((value) => value.includes('.'));

	return relationalFields;
}

// Backoffice: v-button `secondary`/`kind`/`icon`/`href`/`to` → BoButton props, unset ones left out
// (exactOptionalPropertyTypes). v-button renders `href` as an `a` with target `_blank` and rel `noopener noreferrer`;
// an icon-only button needs an aria-label (component-specs Button).
function buttonProps(link: ParsedLink) {
	const result: Record<string, unknown> = {
		variant: link.type === 'primary' ? 'primary' : link.type === 'danger' ? 'danger' : 'secondary',
	};

	if (link.icon || !link.label) result['icon'] = link.icon || 'smart_button';
	if (!link.label) result['ariaLabel'] = t('interfaces.presentation-links.presentation-links');
	if (link.href !== undefined) Object.assign(result, { href: link.href, target: '_blank', rel: 'noopener noreferrer' });
	if (link.to !== undefined) result['to'] = link.to;

	return result;
}
</script>

<template>
	<div :id="a11y?.inputId" :aria-describedby="a11y?.describedBy">
		<div class="flex flex-wrap gap-2">
			<template v-for="(link, index) in linksParsed" :key="index">
				<BoButton
					v-if="link.actionType !== 'flow' || isActiveFlow(link.flow!)"
					class="action"
					:class="[link.type]"
					v-bind="buttonProps(link)"
					:loading="Boolean(link.flow && runningFlows.includes(link.flow))"
					:disabled="link.disabled"
					@click="() => link.flow && runManualFlow(link.flow)"
				>
					<template v-if="link.label" #default>{{ link.label }}</template>
				</BoButton>
			</template>
		</div>

		<BoNotice v-if="fetchError" type="danger" class="mt-3">{{ fetchError }}</BoNotice>
		<FlowDialogs v-if="flowDialogsContext" v-bind="flowDialogsContext" />
	</div>
</template>
