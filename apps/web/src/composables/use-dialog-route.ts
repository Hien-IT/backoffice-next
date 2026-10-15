// Ported from directus/app/src/composables/use-dialog-route.ts
// Backoffice: Directus holds the route change until v-dialog calls the injected `leave` after its close transition;
// BoDialog (Reka Dialog) has no such hook, so the guard closes the dialog and lets the route change at once (otherwise
// navigation away would wait forever). `useDialogRouteLeave` is not ported for the same reason.
import { onMounted, type Ref, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

export function useDialogRoute(): Ref<boolean> {
	const isOpen = ref(false);

	onMounted(() => {
		isOpen.value = true;
	});

	onBeforeRouteLeave(() => {
		isOpen.value = false;
	});

	return isOpen;
}
