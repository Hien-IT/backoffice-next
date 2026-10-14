import { useBreakpoints } from '@vueuse/core';
import type { Ref } from 'vue';
import { BREAKPOINTS } from '../constants.ts';

/** `lg` and `xl` of BREAKPOINTS as min-width media queries, like `useBreakpoints(BREAKPOINTS)` in Directus. */
export function useLayoutBreakpoints(): { lg: Ref<boolean>; xl: Ref<boolean> } {
	const { lg, xl } = useBreakpoints(BREAKPOINTS);
	return { lg, xl };
}
