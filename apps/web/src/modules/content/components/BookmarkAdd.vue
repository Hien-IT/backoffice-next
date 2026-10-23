<!-- Ported from directus/app/src/views/private/components/bookmark-add.vue -->
<script setup lang="ts">
// Backoffice: v-dialog is BoDialog (recipe "Bookmark dialog", component-specs 014): closing it (Esc, outside click)
// is the DR `@esc` cancel; Enter submits the form (DR `@apply`). The activator slot gets `{ on }` like
// v-dialog's.
import { reactive, useId } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import InterfaceSystemInputTranslatedString from '../../../interfaces/_system/system-input-translated-string/InputTranslatedString.vue';
import InterfaceSelectColor from '../../../interfaces/select-color/SelectColor.vue';
import InterfaceSelectIcon from '../../../interfaces/select-icon/SelectIcon.vue';

const props = defineProps<{
	modelValue?: boolean;
	saving?: boolean;
}>();

const emit = defineEmits<{
	(e: 'save', value: { name: string | null; icon: string | null; color: string | null }): void;
	(e: 'update:modelValue', value: boolean): void;
}>();

defineSlots<{ activator?: (props: { on: () => void }) => unknown }>();

const formId = useId();

const bookmarkValue = reactive<{ name: string | null; icon: string | null; color: string | null }>({
	name: null,
	icon: 'bookmark',
	color: null,
});

function setIcon(icon: any) {
	bookmarkValue.icon = icon;
}

function setColor(color: any) {
	bookmarkValue.color = color;
}

function save() {
	if (bookmarkValue.name === null || props.saving) return;

	emit('save', { ...bookmarkValue });
}

function cancel() {
	bookmarkValue.name = null;
	bookmarkValue.icon = 'bookmark';
	bookmarkValue.color = null;
	emit('update:modelValue', false);
}
</script>

<template>
	<slot name="activator" :on="() => emit('update:modelValue', true)" />

	<BoDialog
		:open="!!modelValue"
		:title="$t('create_bookmark')"
		@update:open="$event ? emit('update:modelValue', true) : cancel()"
	>
		<form :id="formId" class="fields grid grid-cols-2 gap-4" @submit.prevent="save">
			<InterfaceSystemInputTranslatedString
				:value="bookmarkValue.name"
				class="full col-span-2"
				autofocus
				:placeholder="$t('bookmark_name')"
				@input="bookmarkValue.name = $event"
			/>
			<InterfaceSelectIcon width="half" :value="bookmarkValue.icon" @input="setIcon" />
			<InterfaceSelectColor width="half" :value="bookmarkValue.color" @input="setColor" />
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="cancel">
				{{ $t('cancel') }}
			</BoButton>
			<BoButton type="submit" :form="formId" :disabled="bookmarkValue.name === null" :loading="!!saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
