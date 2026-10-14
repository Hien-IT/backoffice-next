// Ported from directus/app/src/utils/user-name.ts
import { i18n } from '../lang/index.ts';
import type { AppUser } from '../types/user.ts';

export function userName(user?: Partial<AppUser>): string {
	if (!user) {
		return i18n.global.t('unknown_user') as string;
	}

	if (user.first_name && user.last_name) {
		return `${user.first_name} ${user.last_name}`;
	}

	if (user.first_name) {
		return user.first_name;
	}

	if (user.email) {
		return user.email;
	}

	return i18n.global.t('unknown_user') as string;
}
