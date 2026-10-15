<!-- Ported from directus/app/src/layouts/cards/components/card.vue -->
<script setup lang="ts">
// Backoffice: recipe "Cards grid (Q-3)". The card body is a link to the item (`href` from the router, Enter opens it,
// Space and the click toggle the selection in select mode as Directus); the selector is a BoCheckbox outside the link
// (no interactive element inside a link) named after the item key, visible on hover/focus or in select mode; the
// selected card gets `ring-2 ring-brand-500` instead of the inner border; v-icon-file is inlined (file icon + extension).
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoIcon from '../../../components/BoIcon.vue';
import { getAssetUrl } from '../../../utils/get-asset-url.ts';
import { readableMimeType } from '../../../utils/readable-mime-type.ts';

defineOptions({ name: 'LayoutCardsCard' });

type File = {
	[key: string]: any;
	id: string;
	type: string;
	modified_on: Date;
};

const props = withDefaults(
	defineProps<{
		itemKey: string;
		icon?: string | undefined;
		file?: File | null;
		crop?: boolean;
		loading?: boolean;
		item?: Record<string, any> | undefined;
		modelValue?: (string | number)[];
		selectMode?: boolean;
		to?: string | undefined;
		readonly?: boolean;
	}>(),
	{
		icon: 'box',
		file: null,
		item: undefined,
		modelValue: () => [],
		to: '',
	},
);

const emit = defineEmits(['update:modelValue']);

const router = useRouter();

const imgError = ref(false);

const type = computed(() => {
	if (!props.file || !props.file.type) return null;
	if (!imgError.value && props.file.type.startsWith('image')) return null;
	return readableMimeType(props.file.type, true);
});

const imageInfo = computed(() => {
	let fileType = undefined;
	if (!props.file || !props.file.type) return null;
	if (props.file.type.startsWith('image') === true) fileType = 'image';
	if (props.file.type.includes('svg')) fileType = 'svg';

	// Show icon instead of thumbnail
	if (!fileType) return { source: undefined, fileType };

	let key = 'system-medium-cover';

	if (props.crop === false) {
		key = 'system-medium-contain';
	}

	const source = getAssetUrl(props.file.id, {
		imageKey: key,
		cacheBuster: props.file.modified_on,
	});

	return { source, fileType };
});

const showThumbnail = computed(() => {
	return imageInfo.value && imageInfo.value.fileType;
});

const selected = computed(() => !!props.item && props.modelValue.includes(props.item[props.itemKey]));

const href = computed(() => (props.to ? router.resolve(props.to).href : undefined));

function toggleSelection() {
	if (!props.item) return;

	if (props.modelValue.includes(props.item[props.itemKey])) {
		emit(
			'update:modelValue',
			props.modelValue.filter((key) => key !== props.item?.[props.itemKey]),
		);
	} else {
		emit('update:modelValue', [...props.modelValue, props.item[props.itemKey]]);
	}
}

function handleClick(event: MouseEvent | KeyboardEvent) {
	const selecting = props.selectMode === true || props.modelValue.length > 0;
	// Ctrl/Cmd click outside select mode: the browser opens the link in a new tab (as use-layout-click-handler).
	if (!selecting && (event.ctrlKey || event.metaKey)) return;

	event.preventDefault();

	if (selecting) {
		toggleSelection();
	} else if (props.to) {
		router.push(props.to);
	}
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div
		class="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.03]"
		:class="{ 'ring-2 ring-brand-500': selected, 'pointer-events-none': readonly }"
		:data-selected="selected || undefined"
	>
		<template v-if="loading">
			<div class="aspect-square animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"></div>
			<div class="mt-2 h-4 w-2/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-800"></div>
		</template>
		<a
			v-else
			:href="href"
			:tabindex="readonly ? -1 : 0"
			:aria-label="$slots['title'] ? undefined : String(item?.[itemKey] ?? '')"
			class="flex cursor-pointer flex-col gap-2 rounded-xl"
			:class="FOCUS"
			@click="handleClick"
			@keydown.space.prevent="handleClick"
		>
			<div
				class="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
			>
				<span v-if="type || imgError" class="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400">
					<BoIcon name="insert_drive_file" size="lg" />
					<span class="text-theme-xs font-medium uppercase">{{ type }}</span>
				</span>
				<img
					v-else-if="showThumbnail"
					:src="imageInfo?.source"
					alt=""
					:class="
						imageInfo?.fileType === 'svg'
							? 'h-3/4 w-3/4 object-contain'
							: ['h-full w-full', crop === false ? 'object-contain' : 'object-cover']
					"
					@error="imgError = true"
				/>
				<span v-else class="text-gray-500 dark:text-gray-400"><BoIcon :name="icon ?? 'box'" size="lg" /></span>
			</div>
			<div v-if="$slots['title']" class="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
				<slot name="title" />
			</div>
			<div v-if="$slots['subtitle']" class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
				<slot name="subtitle" />
			</div>
		</a>
		<div
			v-if="!loading && item"
			class="absolute start-3 top-3 flex rounded-md bg-white transition-opacity group-hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none dark:bg-gray-900"
			:class="selected || selectMode || modelValue.length > 0 ? 'opacity-100' : 'opacity-0'"
		>
			<BoCheckbox
				:model-value="selected"
				:disabled="readonly"
				:aria-label="$t('select_item_key', { item: item[itemKey] })"
				@update:model-value="toggleSelection"
			/>
		</div>
	</div>
</template>
