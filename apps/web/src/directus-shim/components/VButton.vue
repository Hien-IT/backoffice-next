<!-- Ported from directus/app/src/components/v-button.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): wraps BoButton (extended with size, square, shape, outlined, dashed, active,
// align, the status variants and the `loading` slot). `kind`/`secondary`/`warning`/`danger` map to the BoButton
// variant; `dashed` draws one neutral dashed recipe whatever the kind. Deviations: a loading button is a disabled
// button (BoButton recipe) and keeps its label next to the spinner; an icon button gets its tooltip as aria-label.
import { useGroupable } from '@directus/composables';
import { isEqual, isNil } from 'lodash-es';
import { computed } from 'vue';
import { useLink, useRoute, type RouteLocationRaw } from 'vue-router';
import BoButton from '../../components/BoButton.vue';
import vFocus from '../directives/focus.ts';
import vTooltip from '../directives/tooltip.ts';

interface Props {
	autofocus?: boolean;
	kind?: 'normal' | 'info' | 'success' | 'warning' | 'danger';
	fullWidth?: boolean;
	rounded?: boolean;
	outlined?: boolean;
	icon?: boolean;
	type?: string;
	disabled?: boolean;
	loading?: boolean;
	to?: RouteLocationRaw;
	href?: string;
	target?: string;
	active?: boolean | undefined;
	exact?: boolean;
	query?: boolean;
	secondary?: boolean;
	/** @deprecated The `kind` prop should be used instead */
	warning?: boolean;
	/** @deprecated The `kind` prop should be used instead */
	danger?: boolean;
	value?: number | string;
	dashed?: boolean;
	tile?: boolean;
	align?: 'left' | 'center' | 'right';
	download?: string;
	xSmall?: boolean;
	small?: boolean;
	large?: boolean;
	xLarge?: boolean;
	tooltip?: string;
}

const props = withDefaults(defineProps<Props>(), {
	kind: 'normal',
	type: 'button',
	to: '',
	target: '_blank',
	align: 'center',
	/** Must be explicitly undefined */
	active: undefined,
});

const emit = defineEmits(['click']);

const route = useRoute();

const { route: linkRoute, isActive, isExactActive } = useLink({ to: computed(() => props.to) });

const { active, toggle } = useGroupable({
	value: props.value as string | number,
	group: 'item-group',
});

const isActiveRoute = computed(() => {
	if (props.active !== undefined) return props.active;

	if (props.to) {
		const isQueryActive = !props.query || isEqual(route.query, linkRoute.value.query);

		if (!props.exact) {
			return (isActive.value && isQueryActive) || active.value;
		} else {
			return (isExactActive.value && isQueryActive) || active.value;
		}
	}

	return false;
});

// DR: the kind class on the button wins over the secondary/warning/danger classes of the wrapper, and of
// those `.secondary` comes last in the stylesheet.
const variant = computed(() => {
	if (props.kind !== 'normal') return props.kind;
	if (props.secondary) return 'secondary';
	if (props.danger) return 'danger';
	if (props.warning) return 'warning';
	return 'primary';
});

const size = computed(() => {
	if (props.xSmall) return 'xs';
	if (props.small) return 'sm';
	if (props.large) return 'lg';
	if (props.xLarge) return 'xl';
	return undefined;
});

// DR v-button.vue:280-283,383-386,389-391 sizing hooks; the size classes set their own min width (:353-379).
const MIN_WIDTHS = { xs: 'min-w-[3.375rem]', sm: 'min-w-[6.75rem]', lg: 'min-w-[8.6875rem]', xl: 'min-w-[10.125rem]' };
const sizing = computed(() => {
	if (props.icon) return size.value ? '' : 'w-(--v-button-height,2.5rem) h-(--v-button-height,2.5rem) min-w-0';
	const width = props.fullWidth ? 'min-w-full' : 'w-(--v-button-width,auto)';
	if (size.value) return [width, !props.fullWidth && MIN_WIDTHS[size.value]];
	return [width, 'h-(--v-button-height,2.5rem)', !props.fullWidth && 'min-w-(--v-button-min-width,7.875rem)'];
});

// DR: disabled → button, href → a, to → router-link, else button (BoButton renders the disabled button).
const link = computed(() => {
	if (!isNil(props.href)) return { href: props.href, target: props.target, rel: 'noopener noreferrer' };
	if (props.to) return { to: props.to };
	return {};
});

function onClick(event: MouseEvent) {
	if (props.loading === true) return;
	// Toggles the active state in the parent groupable element. Allows buttons to work ootb in button-groups
	toggle();
	emit('click', event);
}
</script>

<template>
	<div class="v-button inline-flex items-center" :class="{ 'flex min-w-full': fullWidth }">
		<slot name="prepend-outer" />
		<BoButton
			v-focus="autofocus"
			v-tooltip.bottom="tooltip"
			v-bind="link"
			class="button"
			:class="sizing"
			:variant
			:type="type as 'button'"
			:disabled
			:loading
			:full-width
			:size
			:square="icon"
			:shape="rounded ? 'circle' : tile ? 'tile' : undefined"
			:outlined
			:dashed
			:active="isActiveRoute"
			:align="align === 'left' ? 'start' : align === 'right' ? 'end' : undefined"
			:download
			:aria-label="icon ? tooltip : undefined"
			@click="onClick"
		>
			<!-- DR v-button.vue:393-398: the label stays on one line with an ellipsis. -->
			<span class="content flex max-w-full min-w-0 items-center gap-2 truncate">
				<slot v-bind="{ active, toggle }" />
			</span>
			<template v-if="$slots['loading']" #loading><slot name="loading" /></template>
		</BoButton>
		<slot name="append-outer" />
	</div>
</template>
