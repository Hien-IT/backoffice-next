// Ported from directus/packages/types/src/users.ts (subset: UserIntegrityCheckFlag; the user and role types come with feature 004)
export enum UserIntegrityCheckFlag {
	None = 0,
	/** Check if the number of remaining admin users is greater than 0 */
	RemainingAdmins = 1 << 0,
	/** Check if the number of users is within the limits */
	UserLimits = 1 << 1,
	All = ~(~0 << 2),
}
