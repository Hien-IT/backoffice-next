<!-- Ported from directus/app/src/interfaces/presentation-header/header.vue -->
<script setup lang="ts">
// Backoffice: template on the page header recipe (layout-patterns §5) with BoButton, BoDialog and BoMenu (Dropdown
// menu recipe). Link types map to the Button variants
// (primary, danger, else outline): the DR info/success/warning button colors have no recipe. The narrow
// container hides the "Actions" text instead of swapping buttons. A flow runs through useInjectRunManualFlow, which
// falls back to its own useFlows and emits `ran` so the screen can reload the item (FR-057).
import type { Collection } from '@directus/types';
import { render } from 'micromustache';
import { computed, inject, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../../components/BoButton.vue';
import BoDialog from '../../components/BoDialog.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoMenu, { type BoMenuItem } from '../../components/BoMenu.vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { useInjectRunManualFlow } from '../../composables/use-run-manual-flow.ts';
import { useTemplateData } from '../../composables/use-template-data.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import FlowDialogs from './FlowDialogs.vue';
import HelperText from './HelperText.vue';

type Link = {
	icon: string;
	label: string;
	type: 'normal' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
	actionType: string;
	url?: string;
	flow?: string;
};

type ParsedLink = Omit<Link, 'url' | 'flow'> & {
	flow?: string | undefined;
	to?: string | undefined;
	href?: string | undefined;
	disabled: boolean;
	loading: boolean;
};

const props = withDefaults(
	defineProps<{
		icon?: string | undefined;
		title?: string | undefined;
		subtitle?: string | undefined;
		links?: Link[];
		help?: string;
		helpDisplayMode?: 'inline' | 'modal';
		enableHelpTranslations?: boolean;
		helpTranslationsString?: string | undefined;
		color?: string | undefined;
		collection: string;
		primaryKey?: string | number | null;
		disabled?: boolean;
		nonEditable?: boolean;
	}>(),
	{
		links: () => [],
		help: '',
		helpDisplayMode: 'inline',
		enableHelpTranslations: false,
		helpTranslationsString: undefined,
	},
);

const emit = defineEmits(['ran']);

const { t, te } = useI18n();

const a11y = inject(FORM_FIELD_A11Y, null);
const helpId = useId();

const fieldsStore = useFieldsStore();

const fields = computed(() => {
	return fieldsStore.getFieldsForCollection(props.collection);
});

const itemValues = inject('values', ref<Record<string, any>>({}));

const primaryKey = computed(() => props.primaryKey ?? null);

const combinedItemData = computed(() => {
	const result = { ...itemValues.value };

	if (fetchedTemplateData.value) {
		Object.entries(fetchedTemplateData.value).forEach(([key, value]) => {
			if (
				value !== null &&
				typeof value === 'object' &&
				(!result[key] || typeof result[key] !== 'object' || result[key] === null)
			) {
				result[key] = value;
			}
		});
	}

	return result;
});

const linksParsed = computed<ParsedLink[]>(() =>
	props.links.map((link) => {
		const interpolatedUrl = link.url ? render(link.url, itemValues.value) : '';
		const isInternalLink = interpolatedUrl?.startsWith('/');

		return {
			icon: link.icon,
			type: link.type,
			label: link.label,
			actionType: link.actionType,
			to: isInternalLink ? interpolatedUrl : undefined,
			href: isInternalLink ? undefined : interpolatedUrl,
			flow: link.actionType === 'flow' ? link.flow : undefined,
			disabled: isDisabled(),
			loading: link.actionType === 'flow' && runningFlows.value.includes(link.flow ?? ''),
		};

		function isDisabled() {
			if (props.disabled && !props.nonEditable) return true;

			return link.actionType === 'flow' && (props.nonEditable || props.primaryKey === '+');
		}
	}),
);

// Backoffice: v-button `secondary`/`kind` → BoButton `variant`.
function variantOf(type: Link['type']) {
	if (type === 'primary') return 'primary';
	if (type === 'danger') return 'danger';
	return 'secondary';
}

// Backoffice: v-button `icon` (icon-only without a label) and the `smart_button` fallback icon; an icon-only button
// needs an aria-label (component-specs Button). Unset props are left out (exactOptionalPropertyTypes).
function iconProps(link: Pick<Link, 'icon' | 'label'>): { icon?: string; ariaLabel?: string } {
	if (link.label) return link.icon ? { icon: link.icon } : {};
	return { icon: link.icon || 'smart_button', ariaLabel: t('interfaces.header.links') };
}

const buttonProps = computed<Record<string, unknown>[]>(() =>
	linksParsed.value.map((link) => {
		const baseProps = {
			class: ['action', link.type],
			variant: variantOf(link.type),
			disabled: link.disabled,
			loading: link.loading,
			...iconProps(link),
		};

		if (link.actionType === 'url' && link.href) {
			// Backoffice: DR also passes `to`, always undefined here (an internal link has no href).
			return {
				...baseProps,
				href: link.href,
				// v-button renders an `a` with target `_blank` and rel `noopener noreferrer`.
				target: '_blank',
				rel: 'noopener noreferrer',
			};
		} else if (link.flow) {
			return {
				...baseProps,
				onClick: () => handleActionClick(link),
			};
		}

		return baseProps;
	}),
);

const expanded = ref(false);
const showHelpModal = ref(false);

function toggleHelp() {
	if (props.helpDisplayMode === 'modal') {
		showHelpModal.value = true;
	} else {
		expanded.value = !expanded.value;
	}
}

async function handleActionClick(action: Pick<ParsedLink, 'actionType' | 'flow'>) {
	if (action.actionType === 'flow' && action.flow) {
		if (runningFlows.value.includes(action.flow)) return;

		runManualFlow(action.flow);
	}
}

const primaryLink = computed(() => {
	if (linksParsed.value.length === 1) {
		return linksParsed.value[0];
	}

	return null;
});

const primaryLinkProps = computed(() => {
	if (primaryLink.value) {
		return buttonProps.value[0];
	}

	return null;
});

const helpText = computed(() => {
	if (props.enableHelpTranslations && props.helpTranslationsString) {
		return props.helpTranslationsString;
	}

	return props.help;
});

const collectionRef = computed(
	() =>
		({
			collection: props.collection,
			meta: {},
		}) as Collection,
);

const templateForData = computed(() => {
	const templateParts = [];

	if (props.title) templateParts.push(props.title);
	if (props.subtitle) templateParts.push(props.subtitle);

	props.links?.forEach((link) => {
		if (link.url) templateParts.push(link.url);
	});

	if (templateParts.length) {
		return templateParts.join(' ');
	}

	return '';
});

const { templateData: fetchedTemplateData } = useTemplateData(collectionRef, primaryKey, {
	template: ref(templateForData.value),
});

const { runManualFlow, runningFlows, flowDialogsContext } = useInjectRunManualFlow({
	collection: computed(() => props.collection),
	primaryKey,
	onRefreshCallback: () => emit('ran'),
});

// Backoffice: `$t(link.label)` without the missing-key warning for plain labels (`$t:` labels come translated).
function translateLabel(label: string) {
	return label && te(label) ? t(label) : label;
}

// The v-list of the "Actions" menu: a url link without a target shows only its icon, as DR.
const menuItems = computed<BoMenuItem[]>(() =>
	linksParsed.value.map((link) => ({
		text: link.actionType === 'url' && !link.to && !link.href ? '' : translateLabel(link.label),
		icon: link.icon,
		to: link.actionType === 'url' ? link.to : undefined,
		href: link.actionType === 'url' ? link.href : undefined,
		disabled: link.disabled || link.loading,
		loading: link.loading,
		onSelect: () => (link.actionType === 'flow' ? handleActionClick(link) : null),
	})),
);
</script>

<template>
	<div :id="a11y?.inputId" class="relative block w-full" :aria-describedby="a11y?.describedBy">
		<div
			class="@container flex w-full min-w-0 justify-between gap-3 border-b border-gray-200 pb-2 dark:border-gray-800"
			:class="title && subtitle ? 'items-center' : 'items-baseline'"
		>
			<div class="min-w-0">
				<p
					v-if="title"
					data-title
					class="flex items-center gap-2 overflow-hidden text-xl font-semibold text-ellipsis whitespace-nowrap text-gray-800 dark:text-white/90"
				>
					<BoIcon v-if="icon" :name="icon" class="shrink-0" :style="color ? { color } : undefined" />
					<RenderTemplate :collection="collection" :fields="fields" :item="combinedItemData" :template="title" />
				</p>
				<p
					v-if="subtitle"
					data-subtitle
					class="flex items-center gap-2 overflow-hidden text-sm text-ellipsis whitespace-nowrap text-gray-500 dark:text-gray-400"
					:class="title ? 'mt-1' : 'standalone'"
				>
					<BoIcon v-if="icon && !title" :name="icon" class="shrink-0" :style="color ? { color } : undefined" />
					<RenderTemplate :collection="collection" :fields="fields" :item="combinedItemData" :template="subtitle" />
				</p>
			</div>
			<div class="shrink-0">
				<div class="actions-container flex items-center gap-3">
					<BoButton
						v-if="help"
						data-help-button
						:variant="expanded ? 'primary' : 'secondary'"
						icon="help_outline"
						:aria-label="t('interfaces.header.help.title')"
						:aria-expanded="helpDisplayMode === 'modal' ? undefined : expanded"
						:aria-controls="helpDisplayMode === 'modal' || !expanded ? undefined : helpId"
						:aria-haspopup="helpDisplayMode === 'modal' ? 'dialog' : undefined"
						@click="toggleHelp"
					/>

					<template v-if="primaryLink">
						<BoButton v-if="primaryLink!.href || primaryLink!.flow" v-bind="primaryLinkProps">
							<template v-if="primaryLink!.label" #default>{{ primaryLink!.label }}</template>
						</BoButton>
					</template>

					<BoMenu v-else-if="linksParsed.length > 1" :items="menuItems" align="end">
						<template #trigger>
							<BoButton variant="secondary" data-actions>
								<span class="@max-[33.75rem]:sr-only">{{ t('actions') }}</span>
								<BoIcon name="expand_more" size="sm" />
							</BoButton>
						</template>
					</BoMenu>
				</div>
			</div>
		</div>

		<div
			v-if="expanded && help && helpDisplayMode !== 'modal'"
			:id="helpId"
			data-help-inline
			class="overflow-y-auto border-b border-gray-200 bg-gray-50 px-7 py-9 dark:border-gray-800 dark:bg-white/[0.03]"
		>
			<HelperText :content="helpText" />
			<div class="mt-3.5 flex justify-end">
				<BoButton variant="secondary" @click="toggleHelp">
					{{ t('interfaces.header.collapse') }}
					<BoIcon name="expand_less" size="sm" />
				</BoButton>
			</div>
		</div>

		<BoDialog v-model:open="showHelpModal" :title="t('interfaces.header.help.title')">
			<HelperText :content="helpText" />
			<template #actions>
				<BoButton @click="showHelpModal = false">{{ t('dismiss') }}</BoButton>
			</template>
		</BoDialog>

		<FlowDialogs v-if="flowDialogsContext" v-bind="flowDialogsContext" />
	</div>
</template>
