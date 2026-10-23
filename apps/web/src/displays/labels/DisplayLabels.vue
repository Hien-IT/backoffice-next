<!-- Ported from directus/app/src/displays/labels/labels.vue -->
<script setup lang="ts">
import formatTitle from '@directus/format-title';
import { isEmpty, isString } from 'lodash-es';
import { computed } from 'vue';
import BoChip from '../../components/BoChip.vue';
import BoIcon from '../../components/BoIcon.vue';
import BoTooltip from '../../components/BoTooltip.vue';
import DisplayColor from '../color/DisplayColor.vue';

type Choice = {
	value: string | number;
	text: string;
	icon?: string;
	color?: string;
	foreground: string | null;
	background: string | null;
};

const props = withDefaults(
	defineProps<{
		value: string | number | string[] | number[];
		type: 'text' | 'string' | 'json' | 'csv' | 'integer' | 'bigInteger' | 'float' | 'decimal';
		format?: boolean;
		showAsDot?: boolean;
		choices?: Choice[];
	}>(),
	{
		format: true,
		choices: () => [],
	},
);

const items = computed(() => {
	let items: string[] | number[];

	if (isEmpty(props.value) && isNaN(props.value as number)) items = [];
	else if (['integer', 'bigInteger', 'float', 'decimal'].includes(props.type)) items = [props.value as number];
	else if (isString(props.value)) items = [props.value as string];
	else items = props.value as string[];

	return items.map((item) => {
		const choice = (props.choices || []).find((choice) => choice.value === item);

		let itemStringValue: string;

		if (typeof item === 'object') {
			itemStringValue = JSON.stringify(item);
		} else {
			if (props.format && isNaN(item as any)) {
				itemStringValue = formatTitle(item as string);
			} else {
				itemStringValue = item as string;
			}
		}

		// Backoffice: no choice color = BoChip's own theme colors (DR `--theme--foreground` and
		// `--theme--background-normal`), so `foreground`/`background` stay empty there.
		if (choice === undefined) {
			return {
				value: item,
				text: itemStringValue,
				icon: '',
				color: '',
				foreground: '',
				background: '',
			};
		} else {
			return {
				value: item,
				text: choice.text || itemStringValue,
				icon: choice.icon ?? '',
				color: choice.color ?? '',
				foreground: choice.foreground || '',
				background: choice.background || '',
			};
		}
	});
});
</script>

<template>
	<div class="display-labels inline-flex gap-1">
		<template v-if="!showAsDot">
			<BoChip
				v-for="item in items"
				:key="String(item.value)"
				:text="String(item.text)"
				:color="item.foreground"
				:background="item.background"
			>
				<template #leading>
					<BoIcon
						v-if="item.icon"
						:name="item.icon"
						size="sm"
						class="shrink-0"
						:style="item.color ? { color: item.color } : undefined"
					/>
					<DisplayColor v-else-if="item.color" :value="item.color" />
				</template>
			</BoChip>
		</template>
		<template v-else>
			<BoTooltip v-for="item in items" :key="String(item.value)" :text="String(item.text)">
				<DisplayColor :value="item.color || item.background || 'var(--color-gray-100)'" />
			</BoTooltip>
			<!-- Backoffice: the dots carry the text for screen readers, not by color alone. -->
			<span class="sr-only">{{ items.map((item) => item.text).join(', ') }}</span>
		</template>
	</div>
</template>
