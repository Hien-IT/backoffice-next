<!-- Ported from directus/app/src/views/private/components/user-popover.vue -->
<script setup lang="ts">
import { readUser } from '@directus/sdk';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, onUnmounted, ref, watch } from 'vue';
import { sdk } from '../../api/sdk.ts';
import { getItemRoute } from '../../utils/get-item-route.ts';
import type { AppUser } from '../../types/user.ts';
import { userName } from '../../utils/user-name.ts';
import BoAvatar from '../BoAvatar.vue';
import BoChip from '../BoChip.vue';
import BoIcon from '../BoIcon.vue';

type User = {
	id: string;
	first_name: string | null;
	last_name: string | null;
	email: string | null;
	status: string;
	avatar: { id: string; modified_on: string | null } | null;
	role: { name: string } | null;
};

const props = defineProps<{
	user: string;
}>();

const loading = ref(false);
const error = ref<any>(null);
const data = ref<User | null>(null);

// Backoffice: `role` holds the role name here, not the id AppUser types.
const name = computed(() => (data.value ? userName(data.value as Partial<AppUser>) : ''));

const active = ref(false);

watch(active, () => {
	if (active.value === true && data.value === null && loading.value === false) {
		fetchUser();
	}
});

onUnmounted(() => {
	loading.value = false;
	error.value = null;
	data.value = null;
});

async function fetchUser() {
	loading.value = true;
	error.value = null;

	try {
		// Backoffice: sdk instead of api (axios).
		data.value = (await sdk.request(
			readUser(props.user, {
				fields: ['id', 'first_name', 'last_name', 'avatar.id', 'avatar.modified_on', 'role.name', 'status', 'email'],
			} as Parameters<typeof readUser>[1]),
		)) as User;
	} catch (err: any) {
		error.value = err;
	} finally {
		loading.value = false;
	}
}

// Backoffice: Directus prints the axios error object; the SDK throws `{ errors }`, so its first message is shown.
function errorText(err: any): string {
	return err?.errors?.[0]?.message ?? err?.message ?? String(err);
}

// Badge recipe colors per status (Directus status chip colors; draft has no pink in the theme, light instead).
const STATUS_CLASSES: Record<string, string> = {
	active: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
	invited: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
	suspended: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
	archived: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
};

// Backoffice: v-menu trigger="hover" :delay="300" — open after 300 ms over trigger or content, close 300 ms after
// leaving both; click and Enter open it too (UserPopover recipe).
const DELAY = 300;
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let openedByHover = false;

function onPointerEnter(event: PointerEvent) {
	if (event.pointerType === 'touch') return;
	clearTimeout(hoverTimer);

	hoverTimer = setTimeout(() => {
		if (active.value) return;
		openedByHover = true;
		active.value = true;
	}, DELAY);
}

function onPointerLeave(event: PointerEvent) {
	if (event.pointerType === 'touch') return;
	clearTimeout(hoverTimer);
	hoverTimer = setTimeout(() => (active.value = false), DELAY);
}

// Opening on hover must not move focus into the popover; click and keyboard opening do. Reka's own auto focus targets
// the popper wrapper, which has no tabindex (focus stayed on the trigger in chromium), so the content is focused here.
function onOpenAutoFocus(event: Event) {
	event.preventDefault();
	if (!openedByHover) (event.target as HTMLElement).querySelector<HTMLElement>('[role="dialog"]')?.focus();
	openedByHover = false;
}

onUnmounted(() => clearTimeout(hoverTimer));
</script>

<template>
	<PopoverRoot v-model:open="active">
		<PopoverTrigger
			class="inline-flex max-w-full items-center gap-2 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
			@pointerenter="onPointerEnter"
			@pointerleave="onPointerLeave"
		>
			<slot />
		</PopoverTrigger>

		<PopoverPortal>
			<PopoverContent
				side="top"
				:side-offset="4"
				align="start"
				:collision-padding="8"
				class="z-99999 max-h-(--reka-popover-content-available-height) w-[280px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
				@open-auto-focus="onOpenAutoFocus"
				@pointerenter="onPointerEnter"
				@pointerleave="onPointerLeave"
			>
				<div
					v-if="loading"
					class="loading flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400"
					aria-busy="true"
				>
					<BoIcon name="progress_activity" class="animate-spin motion-reduce:animate-none" />
					{{ $t('loading') }}
				</div>

				<div v-else-if="error" class="error text-theme-sm text-error-700 dark:text-error-400" role="alert">
					{{ errorText(error) }}
				</div>

				<div v-else-if="data" class="user-box flex items-center gap-3">
					<BoAvatar
						:avatar-id="data.avatar?.id ?? null"
						:cache-buster="data.avatar?.modified_on ?? null"
						:name="data.first_name ?? ''"
					/>
					<div class="data min-w-0 space-y-1">
						<div class="name truncate text-sm font-medium text-gray-800 dark:text-white/90">{{ name }}</div>
						<div class="flex flex-wrap gap-1">
							<span
								class="status inline-flex items-center rounded-full px-2.5 py-0.5 text-theme-xs font-medium"
								:class="[
									data.status,
									STATUS_CLASSES[data.status] ?? 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
								]"
							>
								{{ $t(`fields.directus_users.status_${data.status}`) }}
							</span>
							<BoChip v-if="data.role?.name" :text="data.role.name" />
						</div>
						<div class="email truncate text-theme-xs text-gray-500 dark:text-gray-400">{{ data.email }}</div>
						<!-- Backoffice: a real link instead of a click handler on the box (keyboard access). -->
						<RouterLink
							:to="getItemRoute('directus_users', data.id)"
							class="text-sm font-medium text-brand-500 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:focus-visible:outline-brand-400"
							@click.stop
						>
							{{ $t('open') }}
						</RouterLink>
					</div>
				</div>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
