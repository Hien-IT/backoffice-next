<!-- Ported from directus/app/src/displays/translations/translations.vue -->
<script setup lang="ts">
import { isNil } from 'lodash-es';
import { computed, toRefs } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoProgressLinear from '../../components/BoProgressLinear.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import ItemsMenu from '../../components/render/ItemsMenu.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import ValueNull from '../../components/render/ValueNull.vue';
import { useRelationM2M } from '../../composables/use-relation-m2m.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useUserStore } from '../../stores/user.ts';

interface Props {
	collection: string;
	field: string;
	type: string;
	value?: Record<string, any>[];
	template?: string | undefined;
	userLanguage?: boolean;
	defaultLanguage?: string | undefined;
	languageField?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	value: () => [],
	template: undefined,
	userLanguage: false,
	defaultLanguage: undefined,
	languageField: undefined,
});

const { collection, field } = toRefs(props);
const fieldsStore = useFieldsStore();
const userStore = useUserStore();

const { relationInfo } = useRelationM2M(collection, field);

const internalTemplate = computed(() => {
	if (!relationInfo.value) return '';

	const primaryKeyField = relationInfo.value.junctionPrimaryKeyField.field;
	const collectionDisplayTemplate = relationInfo.value.junctionCollection?.meta?.display_template;

	return props.template || collectionDisplayTemplate || `{{ ${primaryKeyField} }}`;
});

const displayItem = computed(() => {
	if (!relationInfo.value) return {};

	const langPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const langField = relationInfo.value.junctionField.field;

	let item = props.value.find((val) => val?.[langField]?.[langPkField] === props.defaultLanguage) ?? props.value[0];

	if (props.userLanguage) {
		const lang = userStore.language;
		item = props.value.find((val) => val?.[langField]?.[langPkField] === lang) ?? item;
	}

	return item ?? {};
});

const writableFields = computed(() => {
	if (!relationInfo.value) return [];

	const junctionFields = fieldsStore.getFieldsForCollection(relationInfo.value.junctionCollection.collection);

	return junctionFields.filter(
		(field) => field.type !== 'alias' && field.meta?.hidden === false && field.meta.readonly === false,
	);
});

const translations = computed(() => {
	if (!relationInfo.value) return [];

	const primaryKeyField = relationInfo.value.junctionPrimaryKeyField.field;
	const langPkField = relationInfo.value.relatedPrimaryKeyField.field;
	const langField = relationInfo.value.junctionField.field;

	return props.value.map((item) => {
		const filledFields = writableFields.value.filter((field) => {
			return field.field in item && !isNil(item?.[field.field]);
		}).length;

		return {
			id: item?.[primaryKeyField ?? 'id'],
			lang: item?.[langField]?.[props.languageField ?? langPkField],
			progress: Math.round((filledFields / writableFields.value.length) * 100),
			item,
		};
	});
});

// Backoffice: v-progress-linear `colorful` (danger <= 33, warning <= 66, success) on the bar of BoProgressLinear.
function progressColor(value: number) {
	if (value <= 33) return '[&_[role=progressbar]>div]:bg-error-500';
	if (value <= 66) return '[&_[role=progressbar]>div]:bg-warning-500';
	return '[&_[role=progressbar]>div]:bg-success-500';
}

// Backoffice: Directus shows the icon on hover, focus or while open; touch screens always show it.
const ICON_TRIGGER =
	'flex shrink-0 rounded text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 aria-expanded:opacity-100 disabled:pointer-events-none pointer-coarse:opacity-100 motion-reduce:transition-none dark:text-gray-400 dark:focus-visible:outline-brand-400';
</script>

<template>
	<ValueNull v-if="!relationInfo?.junctionCollection?.collection" />
	<div v-else class="display-translations group inline-flex max-w-full items-center">
		<RenderTemplate
			:template="internalTemplate"
			:item="displayItem"
			:collection="relationInfo.junctionCollection.collection"
		/>
		<!-- Backoffice: ItemsMenu (popover recipe) with an icon trigger instead of v-menu + clickable v-icon. -->
		<ItemsMenu
			class="icon"
			:trigger-class="ICON_TRIGGER"
			:disabled="value.length === 0"
			:aria-label="$t('displays.translations.translations')"
		>
			<template #trigger>
				<BoIcon name="info" size="sm" />
			</template>

			<ul class="links w-[16.875rem] space-y-1">
				<li
					v-for="(item, index) in translations"
					:key="item.id"
					class="px-3 py-1"
					:class="{ 'border-t border-gray-100 pt-2 dark:border-gray-800': index > 0 }"
				>
					<div class="header flex items-center justify-between gap-4 text-theme-xs text-gray-500 dark:text-gray-400">
						<div class="lang flex items-center gap-1 font-semibold">
							<BoIcon name="translate" size="sm" />
							{{ item.lang }}
						</div>
						<BoTooltip :text="`${item.progress}%`">
							<div class="max-w-[5.625rem] flex-1 overflow-hidden rounded" :class="progressColor(item.progress)">
								<BoProgressLinear :value="item.progress" :aria-label="String(item.lang)" />
							</div>
						</BoTooltip>
					</div>
					<RenderTemplate
						class="text-theme-sm text-gray-700 dark:text-gray-400"
						:template="internalTemplate"
						:item="item.item"
						:collection="relationInfo.junctionCollection.collection"
					/>
				</li>
			</ul>
		</ItemsMenu>
	</div>
</template>
