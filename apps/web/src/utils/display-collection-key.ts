// Backoffice (018 D-118, owner 2026-10-18; branding D-51): a system collection key is shown with `backoffice_` instead
// of `directus_` where the Settings data model lists raw keys. The key itself (routes, API) is unchanged.
export function displayCollectionKey(collection: string): string {
	return collection.replace(/^directus_/, 'backoffice_');
}

/** A note that is still an untranslated `$t:` key (`directus_collection.directus_x`) is not shown. */
export function isUntranslatedKey(note: string): boolean {
	return /^[\w-]+\.[\w-]+$/.test(note);
}
