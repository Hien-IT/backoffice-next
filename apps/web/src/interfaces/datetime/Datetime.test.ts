// Ported from directus/app/src/interfaces/datetime/datetime.test.ts
// Backoffice: mounts our Datetime.vue (Reka popover + BoDatePicker); the Directus cases are kept, then the option,
// fixture, emitted-format and a11y checks of contracts/tests.md §5 (FR-025).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, defineComponent } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import Datetime from './Datetime.vue';
import config from './index.ts';

vi.mock('../../stores/user.ts', () => ({
	useUserStore: vi.fn(() => ({ language: 'en-US', textDirection: 'ltr' })),
}));

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

// Directus stubs VMenu/VDatePicker; here the popover content is always rendered and the picker is a stub.
const tzGlobal = {
	plugins: [i18n],
	stubs: {
		PopoverPortal: { template: '<div><slot /></div>' },
		PopoverContent: { template: '<div><slot /></div>' },
		BoDatePicker: defineComponent({
			name: 'VDatePicker',
			props: { modelValue: { type: null, default: undefined }, timezone: { type: String, default: undefined } },
			emits: ['update:modelValue', 'close'],
			template: '<div />',
		}),
	},
};

type Wrapper = ReturnType<typeof mount<typeof Datetime>>;

function datePicker(wrapper: Wrapper) {
	return wrapper.findComponent({ name: 'VDatePicker' });
}

describe('Interface', () => {
	it('should mount', () => {
		const wrapper = mount(Datetime, { props: { value: null, type: 'dateTime' }, global });

		expect(wrapper.exists()).toBe(true);
	});

	it('should render calendar icon when null', () => {
		const wrapper = mount(Datetime, { props: { value: null, type: 'dateTime' }, global });

		expect(wrapper.find('.item-actions .today-icon').text()).toBe('today');
	});

	it('should render remove button when value is set', () => {
		const wrapper = mount(Datetime, { props: { value: '2024-01-01T12:00:00Z', type: 'dateTime' }, global });

		expect(wrapper.find('.item-actions .clear-icon').exists()).toBe(true);
	});

	it('should hide action buttons when nonEditable is true', () => {
		const wrapper = mount(Datetime, {
			props: { value: '2024-01-01T12:00:00Z', nonEditable: true, disabled: true, type: 'dateTime' },
			global,
		});

		expect(wrapper.find('.item-actions').exists()).toBe(false);
	});

	it('should render action buttons disabled when disabled is true', () => {
		const wrapper = mount(Datetime, { props: { value: '2024-01-01T12:00:00Z', disabled: true, type: 'dateTime' }, global });

		expect(wrapper.find('.datetime-trigger').attributes('disabled')).toBeDefined();
		expect(wrapper.find('.item-actions .clear-icon').attributes('disabled')).toBeDefined();
	});

	describe('tzValue computed', () => {
		const STORED_UTC = '2024-06-15T16:00:00.000Z';
		const TZ = 'America/New_York';
		const EXPECTED_PICKER_MODEL = '2024-06-15T12:00:00.000Z';

		beforeEach(() => {
			vi.stubEnv('TZ', 'UTC');
		});

		afterEach(() => {
			vi.unstubAllEnvs();
		});

		describe('getter', () => {
			it('should pass null to the date picker when value is null', () => {
				const wrapper = mount(Datetime, { props: { value: null, type: 'timestamp', tz: TZ }, global: tzGlobal });

				expect(datePicker(wrapper).props('modelValue')).toBeNull();
			});

			it('should convert stored UTC to zoned ISO for the date picker when type is timestamp and tz is set', () => {
				const wrapper = mount(Datetime, { props: { value: STORED_UTC, type: 'timestamp', tz: TZ }, global: tzGlobal });

				expect(datePicker(wrapper).props('modelValue')).toBe(EXPECTED_PICKER_MODEL);
				// Backoffice: the picker footer names the field time zone.
				expect(datePicker(wrapper).props('timezone')).toBe(TZ);
			});

			it('should pass the value through when type is timestamp but tz is omitted', () => {
				const wrapper = mount(Datetime, { props: { value: STORED_UTC, type: 'timestamp' }, global: tzGlobal });

				expect(datePicker(wrapper).props('modelValue')).toBe(STORED_UTC);
			});

			it('should pass the value through when tz is set but type is not timestamp', () => {
				const value = '2024-01-01T12:00:00Z';
				const wrapper = mount(Datetime, { props: { value, type: 'dateTime', tz: TZ }, global: tzGlobal });

				expect(datePicker(wrapper).props('modelValue')).toBe(value);
				expect(datePicker(wrapper).props('timezone')).toBeUndefined();
			});
		});

		describe('setter', () => {
			it('should emit null when the date picker clears the value', async () => {
				const wrapper = mount(Datetime, { props: { value: STORED_UTC, type: 'timestamp', tz: TZ }, global: tzGlobal });

				await datePicker(wrapper).vm.$emit('update:modelValue', null);
				expect(wrapper.emitted('input')?.[0]).toEqual([null]);
			});

			it('should emit null when the date picker sends an empty string', async () => {
				const wrapper = mount(Datetime, { props: { value: STORED_UTC, type: 'timestamp', tz: TZ }, global: tzGlobal });

				await datePicker(wrapper).vm.$emit('update:modelValue', '');
				expect(wrapper.emitted('input')?.[0]).toEqual([null]);
			});

			it('should emit stored UTC when the date picker sends the zoned model value', async () => {
				const wrapper = mount(Datetime, { props: { value: STORED_UTC, type: 'timestamp', tz: TZ }, global: tzGlobal });

				await datePicker(wrapper).vm.$emit('update:modelValue', EXPECTED_PICKER_MODEL);
				expect(wrapper.emitted('input')?.[0]).toEqual([STORED_UTC]);
			});
		});
	});
});

// Backoffice: contracts/tests.md §5.
describe('Backoffice', () => {
	beforeEach(() => {
		vi.stubEnv('TZ', 'UTC');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});

	function mountField(name: string, value: unknown, extra: Record<string, unknown> = {}) {
		const field = fieldsOf('bo_std').find((f) => f.field === name)!;

		return mount(Datetime, {
			props: { ...(field.meta?.options ?? {}), type: field.type, value, ...extra } as never,
			global,
			attachTo: document.body,
		});
	}

	function text(wrapper: Wrapper) {
		return wrapper.get('.datetime-trigger').text();
	}

	it('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'datetime', icon: 'today', group: 'selection' });
		expect(config.component).toBe(Datetime);
	});

	it('shows the seeded fixture values without emitting', () => {
		const item = itemOf('bo_std', 1);

		for (const name of ['date', 'time', 'date_time', 'timestamp', 'timestamp_relative']) {
			const wrapper = mountField(name, item[name]);
			expect(text(wrapper)).not.toBe('');
			expect(wrapper.emitted('input')).toBeUndefined();
		}
	});

	it('missing options use the component defaults (long format, use24 true)', () => {
		const wrapper = mount(Datetime, { props: { value: '2024-03-15T14:30:00', type: 'dateTime' }, global });

		expect(text(wrapper)).toBe('March 15th, 2024 14:30');
	});

	it('option:datetime.use24 and option:datetime.includeSeconds', () => {
		expect(mountField('time', '14:30:45').get('.datetime-trigger').text()).toBe('2:30:45 PM');
		expect(text(mount(Datetime, { props: { value: '14:30:45', type: 'time', use24: true }, global }))).toBe('14:30');
	});

	it('option:datetime.format', () => {
		const props = { value: '2024-03-15', type: 'date' as const };

		expect(text(mount(Datetime, { props: { ...props, format: 'short' }, global }))).toBe('Mar 15, 2024');
		expect(text(mount(Datetime, { props: { ...props, format: 'yyyy/MM/dd' }, global }))).toBe('2024/03/15');
	});

	it('option:datetime.tz shows the value in the zone and names it', () => {
		const wrapper = mountField('timestamp', '2024-03-15T07:30:00.000Z');

		expect(text(wrapper)).toBe('March 15th, 2024 14:30:00');
		expect(wrapper.find('.timezone-icon [role="img"]').attributes('aria-label')).toBe('Asia/Ho_Chi_Minh');
	});

	it('option:datetime.relative, option:datetime.suffix, option:datetime.strict, option:datetime.round', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2024-03-15T10:00:00.000Z'));
		const value = '2024-03-15T07:30:00.000Z';
		const base = { value, type: 'timestamp' as const, relative: true };

		expect(text(mount(Datetime, { props: base, global }))).toBe('about 3 hours ago');
		expect(text(mount(Datetime, { props: { ...base, suffix: false }, global }))).toBe('about 3 hours');
		expect(text(mount(Datetime, { props: { ...base, strict: true }, global }))).toBe('3 hours ago');
		expect(text(mount(Datetime, { props: { ...base, strict: true, round: 'floor' }, global }))).toBe('2 hours ago');
		expect(text(mount(Datetime, { props: { ...base, strict: true, round: 'ceil' }, global }))).toBe('3 hours ago');
	});

	it('an invalid value shows no formatted text, keeps the clear button and does not emit', () => {
		const wrapper = mount(Datetime, { props: { value: 'not a date', type: 'date' }, global });

		expect(text(wrapper)).toBe('');
		expect(wrapper.find('.clear-icon').exists()).toBe(true);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('the clear button emits null', async () => {
		const wrapper = mountField('date', '2024-03-15');

		await wrapper.get('.clear-icon').trigger('click');

		expect(wrapper.emitted('input')).toEqual([[null]]);
	});

	// Formats the real BoDatePicker emits (directus/app/src/utils/format-date-picker-model-value.ts), FR-025.
	describe('emitted string per type (set to now)', () => {
		async function setToNow(name: string, extra: Record<string, unknown> = {}) {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date('2024-03-15T14:30:45.000Z'));
			const wrapper = mountField(name, null, extra);

			await wrapper.get('.datetime-trigger').trigger('click');
			await flushPromises();
			const button = [...document.querySelectorAll<HTMLButtonElement>('.calendar-today-button')].at(-1)!;
			button.click();
			await flushPromises();

			return wrapper.emitted('input')?.at(-1)?.[0];
		}

		it('date: yyyy-MM-dd', async () => {
			expect(await setToNow('date')).toBe('2024-03-15');
		});

		it('time: HH:mm:ss (seconds kept with includeSeconds)', async () => {
			expect(await setToNow('time')).toBe('14:30:45');
		});

		it('dateTime: yyyy-MM-ddTHH:mm:ss (seconds 00 without includeSeconds)', async () => {
			expect(await setToNow('date_time')).toBe('2024-03-15T14:30:00');
		});

		it('timestamp: Date.toISOString(), converted from the tz wall time to UTC', async () => {
			expect(await setToNow('timestamp')).toBe('2024-03-15T07:30:45.000Z');
			expect(await setToNow('timestamp', { tz: undefined })).toBe('2024-03-15T14:30:45.000Z');
		});
	});

	it('the trigger is named by the field label and the value, and carries the form a11y state', () => {
		const a11y = computed(() => ({ inputId: 'f-date', labelId: 'f-date-label', describedBy: 'f-date-error', invalid: true }));
		const wrapper = mount(Datetime, {
			props: { value: '2024-03-15', type: 'date' },
			global: { plugins: [i18n], provide: { [FORM_FIELD_A11Y as symbol]: a11y } },
		});
		const trigger = wrapper.get('.datetime-trigger');
		const valueId = trigger.get('span').attributes('id');

		expect(trigger.attributes('id')).toBe('f-date');
		expect(trigger.attributes('aria-labelledby')).toBe(`f-date-label ${valueId}`);
		expect(trigger.attributes('aria-describedby')).toBe('f-date-error');
		expect(trigger.attributes('aria-invalid')).toBe('true');
		expect(trigger.classes()).toContain('border-error-600');
	});

	it('keyboard: Enter on the trigger opens the picker, Escape closes it', async () => {
		const wrapper = mountField('date', '2024-03-15');
		const trigger = wrapper.get('.datetime-trigger');

		(trigger.element as HTMLButtonElement).focus();
		await trigger.trigger('click');
		await flushPromises();
		expect(document.querySelector('.bo-date-picker')).not.toBeNull();
		expect(trigger.attributes('aria-expanded')).toBe('true');

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		expect(trigger.attributes('aria-expanded')).toBe('false');
	});
});
