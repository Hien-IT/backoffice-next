<!-- Ported from directus/app/src/interfaces/select-color/select-color.vue -->
<script setup lang="ts">
import Color, { type ColorInstance } from 'color';
import {
	PopoverAnchor,
	PopoverContent,
	PopoverPortal,
	PopoverRoot,
	PopoverTrigger,
	SliderRange,
	SliderRoot,
	SliderThumb,
	SliderTrack,
} from 'reka-ui';
import { computed, ref, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { cssVar } from '../utils/css-var.ts';
import BoButton from './BoButton.vue';
import BoIcon from './BoIcon.vue';
import BoSelect from './BoSelect.vue';
import BoTooltip from './BoTooltip.vue';

// Backoffice: generic picker (trigger + panel) with modelValue; the select-color interface maps `value`/`input`.
// `width` of the interface only laid out the inputs grid, the panel here has a fixed width (ColorPicker recipe).
const { t } = useI18n();

interface Props {
	disabled?: boolean;
	nonEditable?: boolean;
	modelValue?: string | null | undefined;
	placeholder?: string | undefined;
	presets?: { name: string; color: string }[] | undefined;
	opacity?: boolean;
	invalid?: boolean;
	id?: string | undefined;
	/** Form linking on the text input (FormField ids). */
	ariaLabelledby?: string | undefined;
	ariaDescribedby?: string | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	disabled: false,
	nonEditable: false,
	modelValue: null,
	placeholder: undefined,
	presets: undefined,
	opacity: false,
	invalid: false,
	id: undefined,
	ariaLabelledby: undefined,
	ariaDescribedby: undefined,
});

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const inputId = props.id ?? useId();
const open = ref(false);

// Reactive translations can't be default values of props
const presetsWithDefaults = computed(
	() =>
		props.presets || [
			{
				name: t('colors.purple'),
				color: '#6644FF', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.blue'),
				color: '#3399FF', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.green'),
				color: '#2ECDA7', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.yellow'),
				color: '#FFC23B', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.orange'),
				color: '#FFA439', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.red'),
				color: '#E35169', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.black'),
				color: '#18222F', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.gray'),
				color: '#A2B5CD', // raw-color-allowed: Directus data default (Q-C)
			},
			{
				name: t('colors.white'),
				color: '#FFFFFF', // raw-color-allowed: Directus data default (Q-C)
			},
		],
);

// Ported from directus/app/src/utils/is-css-var.ts
const isCssVarUtil = (input: string): boolean =>
	(input.match(/\(/g)?.length || 0) === (input.match(/\)/g)?.length || 0) &&
	input.startsWith('var(') &&
	input.endsWith(')');

// Ported from directus/app/src/utils/is-hex.ts
function isHex(hex: string): boolean {
	return /^#(([a-f\d]{3,4}))$/i.test(hex) || /^#(([a-f\d]{2}){3,4})$/i.test(hex);
}

// Backoffice: the FIELD and POPOVER recipe backgrounds stand in for the Directus theme variables
// `--theme--form--field--input--background` and `--theme--popover--menu--background`.
const isDark = () => document.documentElement.classList.contains('dark');
const fieldBackground = () => cssVar(isDark() ? '--color-gray-900' : '--color-white');
const popoverBackground = () => cssVar(isDark() ? '--color-gray-dark' : '--color-white');

const isCssVar = computed(() => {
	if (!props.modelValue) return false;
	return isCssVarUtil(props.modelValue);
});

const valueWithoutVariables = computed(() => {
	if (!props.modelValue) return null;
	return isCssVar.value ? cssVar(props.modelValue.substring(4, props.modelValue.length - 1)) : props.modelValue;
});

const htmlColorInput = useTemplateRef<HTMLInputElement>('htmlColorInput');
type ColorType = 'RGB' | 'HSL' | 'RGBA' | 'HSLA';

const colorTypes = props.opacity ? ref<ColorType[]>(['RGBA', 'HSLA']) : ref<ColorType[]>(['RGB', 'HSL']);
const colorType = ref<ColorType>(props.opacity ? 'RGBA' : 'RGB');

const isValidColor = computed<boolean>(() => rgb.value !== null && valueWithoutVariables.value !== null);

const lowContrast = computed(() => {
	if (color.value === null) return true;

	const pageColorString = fieldBackground();

	try {
		const pageColor = Color(pageColorString);
		return color.value.contrast(pageColor) < 1.1;
	} catch {
		return true;
	}
});

const getPresetContrast = (hex: string) => {
	if (hex.startsWith('--')) hex = cssVar(hex);

	// Backoffice: an unreadable color counts as low contrast (Directus throws while rendering).
	try {
		const color = Color(hex);
		return color.contrast(Color(popoverBackground())) < 1.1;
	} catch {
		return true;
	}
};

const { hsl, rgb, hex, alpha, color, input, onChanged } = useColor();

const showSwatch = computed(() => {
	if (color.value) return true;
	if (isCssVar.value) return true;
	return false;
});

function setValue(type: 'rgb' | 'hsl' | 'alpha', i: number, val: number) {
	// Backoffice: an emptied number input gives NaN; keep the color.
	if (!Number.isFinite(val)) return;

	if (type === 'rgb') {
		const newArray = [...rgb.value];
		newArray[i] = val;
		rgb.value = newArray;
	} else if (type === 'hsl') {
		const newArray = [...hsl.value];
		newArray[i] = val;
		hsl.value = newArray;
	} else {
		alpha.value = val;
	}
}

function setSwatchValue(color: string) {
	hex.value = `${color}${hex.value !== null && hex.value.length === 9 ? hex.value.slice(-2) : ''}`;
}

function unsetColor() {
	emit('update:modelValue', null);
}

function activateColorPicker() {
	htmlColorInput.value?.click();
}

function useColor() {
	const color = ref<ColorInstance | null>(null);

	const getHexa = (): string | null => {
		if (color.value !== null) {
			if (!props.opacity || color.value.rgb().array().length !== 4) return color.value.hex(); // raw-color-allowed: color package method, not a CSS color

			let alpha = Math.round(255 * color.value.alpha())
				.toString(16)
				.toUpperCase();

			alpha = alpha.padStart(2, '0');
			return `${color.value.hex()}${alpha}`;
		}

		return null;
	};

	watch(
		() => props.modelValue,
		() => {
			try {
				color.value = valueWithoutVariables.value !== null ? Color(valueWithoutVariables.value) : null;
			} catch {
				color.value = null;
			}
		},
		{ immediate: true },
	);

	const rgb = computed<number[]>({
		get() {
			if (color.value !== null) {
				return roundColorValues(color.value.rgb().array()); // raw-color-allowed: color package method, not a CSS color
			}

			return roundColorValues(props.opacity ? [0, 0, 0, 1] : [0, 0, 0]);
		},
		set(newRGB) {
			setColor(Color.rgb(newRGB).alpha(newRGB.length === 4 ? newRGB[3]! : 1)); // raw-color-allowed: color package method, not a CSS color
		},
	});

	const hsl = computed<number[]>({
		get() {
			if (color.value !== null) {
				return roundColorValues(color.value.hsl().array()); // raw-color-allowed: color package method, not a CSS color
			}

			return roundColorValues(props.opacity ? [0, 0, 0, 1] : [0, 0, 0]);
		},
		set(newHSL) {
			setColor(Color.hsl(newHSL).alpha(newHSL.length === 4 ? newHSL[3]! : 1)); // raw-color-allowed: color package method, not a CSS color
		},
	});

	const hex = computed<string | null>({
		get() {
			return getHexa();
		},
		set(newHex) {
			if (newHex === null || newHex === '') {
				unsetColor();
			} else {
				if (isHex(newHex) === false) return;
				setColor(Color(newHex));
			}
		},
	});

	const alpha = computed<number>({
		get() {
			return color.value !== null ? Math.round(color?.value?.alpha() * 100) : 100;
		},
		set(newAlpha) {
			if (newAlpha === null) {
				return;
			}

			const newColor = color.value !== null ? color.value.rgb().array() : [0, 0, 0]; // raw-color-allowed: color package method, not a CSS color
			setColor(Color(newColor).alpha(newAlpha / 100));
		},
	});

	const input = computed<string | null>({
		get() {
			return props.modelValue;
		},
		set(newInput) {
			if (newInput === null || newInput === '') {
				unsetColor();
				return;
			}

			emit('update:modelValue', newInput);

			if (isCssVarUtil(newInput)) {
				try {
					color.value = Color(cssVar(newInput.substring(4, newInput.length - 1)));
				} catch {
					// Color or cssVar could not resolve the color to a color in JS, however, the CSS Var may still be a valid color.
					// So we keep the input value as is and set the internal color to null.
					// This way the user can still edit the input and we can still show the color in the swatch.
					// The color editor (rgb/hsl) will show the color as black (0,0,0) in this case.
					color.value = null;
				}
			}
		},
	});

	return { rgb, hsl, hex, alpha, color, input, onChanged };

	function onChanged() {
		if (!input.value) {
			unsetColor();
			return;
		}

		if (isCssVarUtil(input.value)) return;

		try {
			// If the input is a valid color, we set the color and emit the input as a hex value which is consistent with the dropdown selector and HTML color picker
			const newColor = Color(input.value);
			setColor(newColor);
		} catch {
			// The input is not a valid color, but we still want to let the user edit/type in the input so we emit null to prevent using an invalid value
			unsetColor();
		}
	}

	function setColor(newColor: ColorInstance | null) {
		color.value = newColor;

		if (newColor === null) {
			unsetColor();
		} else {
			emit('update:modelValue', getHexa());
		}
	}

	function roundColorValues(arr: number[]): number[] {
		if (arr.length === 4) {
			// Do not round the opacity
			return [...arr.slice(0, -1).map((x) => Math.round(x)), arr[3]!];
		}

		return arr.map((x) => Math.round(x));
	}
}

// Backoffice: one slider and number input per channel (ColorPicker recipe); the labels are the channel letters of the
// color type, as Directus labels the types themselves (RGB, HSL).
const channels = computed(() => {
	const isRgb = colorType.value === 'RGB' || colorType.value === 'RGBA';
	const values = isRgb ? rgb.value : hsl.value;

	const list: {
		key: string;
		label: string;
		type: 'rgb' | 'hsl' | 'alpha';
		index: number;
		value: number;
		max: number;
	}[] = values.slice(0, 3).map((value, i) => ({
		key: `${colorType.value}-${i}`,
		label: colorType.value[i]!,
		type: isRgb ? 'rgb' : 'hsl',
		index: i,
		value,
		max: isRgb ? 255 : i === 0 ? 360 : 100,
	}));

	if (props.opacity) {
		list.push({
			key: 'alpha',
			label: t('interfaces.select-color.opacity'),
			type: 'alpha',
			index: 0,
			value: alpha.value,
			max: 100,
		});
	}

	return list;
});

const presetHex = (preset: string) => (isHex(preset) ? Color(preset).hex() : preset);
const selectedHex = computed(() => hex.value?.slice(0, 7) ?? null);

// component-specs FOCUS, FIELD, ICON_BTN, Slider and ColorPicker recipes.
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const FIELD =
	'w-full rounded-lg border bg-transparent text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15 read-only:bg-gray-50 dark:read-only:bg-white/[0.03]';
const FIELD_VALID = `border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 ${FOCUS} dark:border-gray-500 dark:focus:border-brand-400`;
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const ICON_BTN = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 ${FOCUS}`;
</script>

<template>
	<PopoverRoot v-model:open="open">
		<PopoverAnchor as-child>
			<div class="bo-color-picker relative">
				<input
					:id="inputId"
					:value="input ?? ''"
					:disabled
					:readonly="nonEditable"
					:placeholder="placeholder || t('interfaces.select-color.placeholder')"
					:aria-labelledby="ariaLabelledby"
					:aria-describedby="ariaDescribedby"
					:aria-invalid="invalid ? 'true' : undefined"
					autocomplete="off"
					spellcheck="false"
					class="h-11 px-4 ps-12 pe-11"
					:class="[FIELD, invalid ? FIELD_INVALID : FIELD_VALID]"
					@input="input = ($event.target as HTMLInputElement).value"
					@change="onChanged"
				/>
				<PopoverTrigger
					class="swatch absolute start-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md disabled:cursor-not-allowed"
					:class="[
						FOCUS,
						showSwatch ? '' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
						lowContrast ? 'ring-1 ring-gray-500 ring-inset' : '',
					]"
					:style="showSwatch ? { background: modelValue ?? undefined } : undefined"
					:disabled="disabled || nonEditable"
					:aria-label="t('pick_color')"
				>
					<BoIcon v-if="!isValidColor" name="colorize" size="sm" />
					<BoIcon v-else-if="!showSwatch" name="question_mark" size="sm" />
				</PopoverTrigger>
				<div v-if="!nonEditable" class="item-actions absolute end-1.5 top-1/2 -translate-y-1/2">
					<button
						v-if="isValidColor"
						type="button"
						:class="ICON_BTN"
						:disabled
						:aria-label="t('clear_value')"
						@click="unsetColor"
					>
						<BoIcon name="close" size="sm" />
					</button>
					<button
						v-else
						type="button"
						:class="ICON_BTN"
						:disabled
						:aria-label="t('pick_color')"
						aria-haspopup="dialog"
						:aria-expanded="open"
						@click="open = !open"
					>
						<BoIcon name="palette" size="sm" />
					</button>
				</div>
			</div>
		</PopoverAnchor>

		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				:collision-padding="8"
				class="z-99999 max-h-(--reka-popover-content-available-height) w-72 space-y-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
			>
				<BoSelect
					:model-value="colorType"
					:items="colorTypes.map((type) => ({ text: type, value: type }))"
					:label="t('interfaces.select-color.color')"
					class="[&>label]:sr-only"
					@update:model-value="colorType = $event as ColorType"
				/>

				<div v-for="channel in channels" :key="channel.key" class="flex items-center gap-3">
					<label
						:id="`${inputId}-${channel.key}-label`"
						:for="`${inputId}-${channel.key}`"
						class="w-5 shrink-0 truncate text-theme-xs text-gray-500 dark:text-gray-400"
						:title="channel.label"
					>
						{{ channel.label }}
					</label>
					<SliderRoot
						:model-value="[channel.value]"
						:min="0"
						:max="channel.max"
						:step="1"
						class="relative flex h-5 w-full touch-none items-center select-none"
						@update:model-value="setValue(channel.type, channel.index, $event?.[0] ?? Number.NaN)"
					>
						<SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
							<SliderRange class="absolute h-full rounded-full bg-brand-500 dark:bg-brand-400" />
						</SliderTrack>
						<SliderThumb
							:aria-labelledby="`${inputId}-${channel.key}-label`"
							class="block h-5 w-5 rounded-full border-2 border-brand-500 bg-white shadow-theme-sm hover:bg-brand-50 dark:border-brand-400 dark:bg-gray-900"
							:class="FOCUS"
						/>
					</SliderRoot>
					<input
						:id="`${inputId}-${channel.key}`"
						type="number"
						:value="channel.value"
						min="0"
						:max="channel.max"
						step="1"
						class="h-9 w-16 shrink-0 px-2"
						:class="[FIELD, FIELD_VALID]"
						@input="setValue(channel.type, channel.index, ($event.target as HTMLInputElement).valueAsNumber)"
					/>
				</div>

				<div class="flex items-end gap-2">
					<div class="grow">
						<label :for="`${inputId}-hex`" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
							HEX
						</label>
						<input
							:id="`${inputId}-hex`"
							:value="hex ?? ''"
							:maxlength="opacity ? 9 : 7"
							autocomplete="off"
							spellcheck="false"
							class="h-9 px-3"
							:class="[FIELD, FIELD_VALID]"
							@change="hex = ($event.target as HTMLInputElement).value"
						/>
					</div>
					<BoButton variant="secondary" icon="colorize" @click="activateColorPicker">
						{{ t('browser_color_picker') }}
					</BoButton>
					<input
						ref="htmlColorInput"
						type="color"
						class="sr-only"
						tabindex="-1"
						aria-hidden="true"
						:value="hex ? hex.slice(0, 7) : undefined"
						@input="setSwatchValue(($event.target as HTMLInputElement).value)"
					/>
				</div>

				<div v-if="presetsWithDefaults" class="presets grid grid-cols-8 gap-2">
					<BoTooltip v-for="preset in presetsWithDefaults" :key="preset.color" :text="preset.name || preset.color">
						<button
							type="button"
							class="preset h-6 w-6 rounded-md"
							:class="[
								FOCUS,
								selectedHex !== null && presetHex(preset.color) === selectedHex
									? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-brand-400 dark:ring-offset-gray-dark'
									: getPresetContrast(preset.color)
										? 'low-contrast ring-1 ring-gray-500 ring-inset'
										: '',
							]"
							:style="{ background: preset.color }"
							:aria-label="preset.name || preset.color"
							:aria-pressed="selectedHex !== null && presetHex(preset.color) === selectedHex"
							@click="() => (hex = preset.color)"
						/>
					</BoTooltip>
				</div>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
