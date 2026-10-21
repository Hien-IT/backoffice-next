<!-- Ported from directus/app/src/components/v-emoji-picker.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): the Directus picker (@joeattardi/emoji-button 4.6.4, its own popup and styles)
// opened by a BoButton icon button named "Insert emoji". Its theme follows the `dark` class of `html` (the app
// theme), not the OS setting; z-index of the menu layer.
import { EmojiButton } from '@joeattardi/emoji-button';
import { onUnmounted } from 'vue';
import BoButton from '../../components/BoButton.vue';

const emojiPicker = new EmojiButton({
	theme: 'light',
	zIndex: 99999,
	position: 'bottom',
	emojisPerRow: 8,
});

const emit = defineEmits(['emoji-selected']);

emojiPicker.on('emoji', (event) => {
	emit('emoji-selected', event.emoji);
});

function toggle(event: MouseEvent) {
	emojiPicker.setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
	emojiPicker.togglePicker(event.currentTarget as HTMLElement);
}

onUnmounted(() => {
	emojiPicker.destroyPicker();
});
</script>

<template>
	<BoButton
		class="emoji-button"
		variant="secondary"
		size="xs"
		square
		shape="circle"
		icon="insert_emoticon"
		:aria-label="$t('insert_emoji')"
		@click="toggle"
	/>
</template>
