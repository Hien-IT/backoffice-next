// Ported from directus/api/src/utils/schedule.ts (validateCron only; scheduleSynchronizedJob needs the
// synchronization module of feature 002).
import { validateCronExpression } from 'cron';

export function validateCron(rule: string): boolean {
	return validateCronExpression(rule).valid;
}
