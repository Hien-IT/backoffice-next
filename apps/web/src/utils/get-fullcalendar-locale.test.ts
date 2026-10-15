import { expect, test } from 'vitest';
import { getFullcalendarLocale, importCalendarLocale } from './get-fullcalendar-locale.ts';

test('loads the locale of the full language code', async () => {
	expect((await getFullcalendarLocale('pt-BR'))?.code).toBe('pt-br');
});

test('falls back to the base language', async () => {
	expect((await getFullcalendarLocale('vi-VN'))?.code).toBe('vi');
	expect((await getFullcalendarLocale('no'))?.code).toBe('nb');
});

test('undefined for a language FullCalendar does not have (its built-in en is used)', async () => {
	expect(await getFullcalendarLocale('en-US')).toBeUndefined();
	expect(await importCalendarLocale('xx')).toBeUndefined();
});
