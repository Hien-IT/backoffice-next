// Ported from directus/packages/composables/src/use-shortcut.ts; Ported from directus/packages/composables/src/translate-shortcut.ts
import { capitalize } from 'lodash-es';
import type { ComponentPublicInstance, Ref } from 'vue';
import { onMounted, onUnmounted, ref } from 'vue';

type ShortcutHandler = (event: KeyboardEvent, cancelNext: () => void) => void | any | boolean;

// Control (Windows/Linux) and Command/Meta (macOS) both map to `meta`.
export const keyMap: Record<string, string> = {
	Control: 'meta',
	Command: 'meta',
};

export const systemKeys = ['meta', 'shift', 'alt', 'backspace', 'delete', 'tab', 'capslock', 'enter', 'home', 'end'];

const keysDown: Set<string> = new Set([]);
const handlers: Record<string, ShortcutHandler[]> = {};
let listenersAttached = false;

function attachGlobalListeners() {
	if (listenersAttached) return;
	listenersAttached = true;

	document.body.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.repeat || !event.key) return;

		keysDown.add(mapKeys(event));
		callHandlers(event);
	});

	document.body.addEventListener('keyup', (event: KeyboardEvent) => {
		if (event.repeat || !event.key) return;
		keysDown.clear();
	});
}

export function useShortcut(
	shortcuts: string | string[],
	handler: ShortcutHandler,
	reference: Ref<HTMLElement | undefined> | Ref<ComponentPublicInstance | undefined> = ref(
		document.body,
	) as Ref<HTMLElement>,
): void {
	const callback: ShortcutHandler = (event, cancelNext) => {
		if (!reference.value) return;
		const ref = reference.value instanceof HTMLElement ? reference.value : (reference.value.$el as HTMLElement);

		if (
			document.activeElement === ref ||
			ref.contains(document.activeElement) ||
			document.activeElement === document.body
		) {
			event.preventDefault();
			return handler(event, cancelNext);
		}

		return false;
	};

	onMounted(() => {
		attachGlobalListeners();

		[shortcuts].flat().forEach((shortcut) => {
			if (shortcut in handlers) {
				handlers[shortcut]?.unshift(callback);
			} else {
				handlers[shortcut] = [callback];
			}
		});
	});

	onUnmounted(() => {
		[shortcuts].flat().forEach((shortcut) => {
			const shortcutHandler = handlers[shortcut];

			if (shortcutHandler) {
				const filteredHandlers = shortcutHandler.filter((f) => f !== callback);

				handlers[shortcut] = filteredHandlers;

				if (filteredHandlers.length === 0) {
					delete handlers[shortcut];
				}
			}
		});
	});
}

function mapKeys(key: KeyboardEvent) {
	const isLatinAlphabet = /^[a-zA-Z0-9]*?$/g;

	let keyString = key.key.match(isLatinAlphabet) === null ? key.code.replace(/(Key|Digit)/g, '') : key.key;

	const keyStringInMap = keyMap[keyString];

	keyString = keyStringInMap ?? keyString;
	keyString = keyString.toLowerCase();

	return keyString;
}

function callHandlers(event: KeyboardEvent) {
	Object.entries(handlers).forEach(([key, value]) => {
		const keys = key.split('+');

		for (key of keysDown) {
			if (keys.includes(key) === false) return;
		}

		for (key of keys) {
			if (keysDown.has(key) === false) return;
		}

		for (let i = 0; i < value.length; i++) {
			let cancel = false;

			value[i]?.(event, () => {
				cancel = true;
			});

			// if cancelNext is called, discontinue going through the queue.
			if (typeof cancel === 'boolean' && cancel) break;
		}
	});
}

export function translateShortcut(keys: string[]): string {
	const isMac = navigator.platform.toLowerCase().startsWith('mac') || navigator.platform.startsWith('iP');

	if (isMac) {
		return keys
			.map((key) => {
				if (key === 'meta') return '⌘';
				if (key === 'option') return '⌥';
				if (key === 'shift') return '⇧';
				if (key === 'alt') return '⌥';
				if (key === 'enter') return '⏎';
				return capitalize(key);
			})
			.join('');
	} else {
		return keys
			.map((key) => {
				if (key === 'meta') return 'Ctrl';
				if (key === 'enter') return '↵';
				return capitalize(key);
			})
			.join('+');
	}
}
