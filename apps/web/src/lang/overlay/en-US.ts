// Backoffice-only strings, merged over the generated translations/en-US.json (spec FR-062).
export default {
	contact_admin_for_link:
		'This system does not send email. Contact an administrator to get the password reset or invitation link.',
	register_not_available_title: 'Registration not available',
	register_not_available: 'Self-registration is not available. Contact an administrator to get an account.',
	skip_to_content: 'Skip to content',
	skip_to_navigation: 'Skip to navigation',
	open_navigation: 'Open navigation',
	open_sidebar: 'Open sidebar',
	close_sidebar: 'Close sidebar',
	play_video: 'Play background video',
	profile: 'Profile',
	navigation: 'Navigation',
	// Owner 2026-10-28: the handle that resizes the inline sidebar.
	resize_navigation: 'Resize navigation',
	// D-200: the toggle that makes the project card of the sidebar compact.
	compact_modules: 'Compact modules',
	// D-162: the sidebar tile of the module_bar links and the extension modules.
	links_and_extensions: 'Links and extensions',
	more_modules: 'More',
	pick_color: 'Pick color',
	browser_color_picker: 'Browser picker',
	// D-201: the deep color presets of the color picker.
	color_royal_blue: 'Royal Blue',
	color_ocean: 'Ocean',
	color_teal: 'Teal',
	color_forest: 'Forest',
	color_burgundy: 'Burgundy',
	color_magenta: 'Magenta',
	color_burnt_orange: 'Burnt Orange',
	// Feature 013: keyboard reorder of sortable lists (D-60), drawers, file previews.
	move_up: 'Move up',
	move_down: 'Move down',
	indent_item: 'Indent',
	outdent_item: 'Outdent',
	item_options: 'Options for {item}',
	moved_to_position: '{item} moved to position {position} of {total}',
	close: 'Close',
	image_load_error: 'The image could not be loaded',
	// Feature 013: map interface controls (no DR key).
	map_zoom_in: 'Zoom in',
	map_zoom_out: 'Zoom out',
	map_geolocate: 'Find my location',
	// Feature 014: keyboard path of the kanban, calendar and manual sort drag and drop (D-69).
	move_left: 'Move left',
	move_right: 'Move right',
	move_to_group: 'Move to group…',
	move_item_to_group: 'Move {item} to group',
	// Feature 014: sort announcement of the table count line (FR-115b, no DR key).
	table_sorted_asc: 'Sorted by {field}, ascending',
	table_sorted_desc: 'Sorted by {field}, descending',
	// Feature 014: label of the save split button menu (recipe Q-8, no DR key).
	more_save_options: 'More save options',
	// Feature 014: name of the card selection checkbox (recipe Q-3, no DR key).
	select_item_key: 'Select {item}',
	// Feature 014: map layout controls and keyboard list (recipe Q-6, D-69, no DR key).
	map_box_select: 'Select an area (Shift + drag)',
	map_items_in_view: 'Items in view',
	// Feature 014: tooltip of the comment send button (recipe Q-11, no DR key).
	comment_submit_shortcut: 'Submit (Ctrl + Enter)',
	// Feature 014: checkbox of the version comparison footer (recipe Q-10, no DR key).
	delete_version_after_promote: 'Delete “{version}” after promotion',
	// Feature 015 (D-88): the DR theme names are shown as Backoffice names (the stored ids keep "DR ..."),
	// so these three keys replace the generated values on purpose.
	theme_directus_default: 'Backoffice Default',
	theme_directus_minimal: 'Backoffice Minimal',
	theme_directus_colormatch: 'Backoffice Color Match',
	// Feature 015 (D-88, CHK042): note under the system-theme list.
	// D-88: choosing a DR theme does not change the Backoffice look; the note says so without naming another app.
	theme_applies_in_directus: 'The theme is saved to your profile. The Backoffice look does not change.',
	// Feature 017 (D-106): above the options of the flow operation "Send Email"; the API only writes a log entry.
	operations_mail_not_sent_notice:
		'Backoffice does not send email. This operation only writes a log entry and returns success.',
	// Feature 017 (FR-106): screen-reader text of a dimmed operation panel that no chain from the trigger reaches.
	flow_operation_not_linked: 'Not linked to the trigger',
	// Feature 017 (FR-106): screen-reader name of the icon of a failed flow run in the Logs section.
	flow_run_failed: 'Failed',
	// Feature 018 (FR-070, recipe Q-38): accessible name of the header bell and the text of its live region.
	notifications_unread_count: 'Notifications, {count} unread',
	// Data Model (owner 2026-10-21): the drop area under an empty folder.
	drop_collections_here: 'Drag collections here',
	// Bell panel (owner 2026-10-21): a notification moves to the archive when it is marked as read (DR status).
	notifications_mark_read: 'Mark as read',
	notifications_mark_all_read: 'Mark all as read',
	notifications_view_all: 'View all',
	// VEmojiPicker shim (spec 020): name of the icon-only button (DR has none).
	insert_emoji: 'Insert emoji',
	// Spec 020: the nav label of the v-pagination shim of app extensions.
	pagination: 'Pagination',
	// Spec 022 (D-182): the card title of the bo_show_* toggles in the Data Model collection form.
	collection_content_toggles: 'Content: Search, Import, Export',
	// Spec 023 (D-187): the JSON path entry of the Content filter (field list item, form, type names, error).
	json_path: 'JSON path',
	json_path_type_text: 'Text',
	json_path_type_number: 'Number',
	json_path_type_boolean: 'Boolean',
	json_path_invalid: 'Invalid JSON path. Examples: Amount, items[0].sku, items[*].sku',
	json_path_apply: 'Apply',
	// Spec 028 (D-206): the field picker of a filter value ($FIELD(b)) on the Content page.
	field_compare: 'Compare with a field',
	field_compare_with: 'Compared with {field}',
	field_compare_value: 'Enter a value',
	field_compare_missing: 'Field {field} not found',
	// Spec 025 (D-189.3): the import and export columns of the permission matrix, the Formats tab of their drawer and
	// the hint of a cell whose bo_show_* toggle is off.
	import: 'Import',
	export: 'Export',
	bo_formats: 'Formats',
	bo_formats_hint: 'No format selected means every format',
	bo_toggle_off_hint: 'Turned off in Data Model for this collection',
	// Spec 029 (D-207.4): the passkey button of the login form and the Passkeys card of the user page.
	passkey_sign_in: 'Sign in with a passkey',
	passkeys: 'Passkeys',
	passkeys_description:
		'Sign in without a password using Touch ID, Windows Hello, a security key or your password manager.',
	passkey_add: 'Add passkey',
	passkey_enter_password: 'Enter your password to add a passkey',
	passkey_name: 'Name',
	passkey_name_title: 'Name this passkey',
	passkey_default_name: 'Passkey on {platform}',
	passkey_rename: 'Rename',
	passkey_delete: 'Delete passkey',
	passkey_delete_confirm: 'Delete "{name}"? You will no longer be able to sign in with it.',
	passkey_admin_delete_text: 'The user will have to add a new passkey to sign in without a password again.',
	passkey_none: 'No passkeys yet',
	passkey_none_hint:
		'Add one to sign in with your fingerprint, face or PIN. If a passkey was deleted here, also remove it from your device.',
	passkey_limit: 'You can have up to 10 passkeys.',
	passkey_created: 'Created',
	passkey_last_used: 'Last used',
	passkey_never_used: 'Never used',
	passkey_actions: 'Passkey actions',
	passkey_already_registered: 'This device already has a passkey for your account.',
	// Spec 030 (D-210.4): the Indexes card of the collection page and the delete-field dialog.
	indexes: 'Indexes',
	indexes_description: 'Composite and search indexes of this collection, created by Backoffice.',
	add_index: 'Add index',
	index_fields_add: 'Add a field…',
	index_type: 'Index type',
	index_type_btree: 'B-tree',
	index_type_trigram: 'Trigram (contains, PostgreSQL)',
	index_unique_label: 'Unique: reject duplicate combinations',
	index_concurrent: 'Create without locking the table',
	index_status_creating: 'Creating…',
	index_status_ready: 'Ready',
	index_status_failed: 'Failed',
	index_missing: 'Missing on the database',
	index_delete_title: 'Delete index?',
	index_delete_text: 'The index is dropped from the database; the rows stay as they are.',
	index_created_notice: 'Index "{name}" is being created',
	index_ready_notice: 'Index "{name}" is ready',
	index_failed_notice: 'Index "{name}" failed: {error}',
	indexes_dropped_with_field: 'These indexes will be dropped:',
	indexes_empty: 'No indexes yet',
	index_help_title: 'How indexes work',
	index_help_intro: 'An index makes the database find rows by these fields faster and, when unique, rejects duplicates.',
	index_help_fields: 'Fields: add them in the order queries filter by them (the first field matters most); drag or use the row menu to reorder.',
	index_help_unique: 'Unique: the combination of all fields must not repeat across rows; rows that already repeat it make the index fail.',
	index_help_trigram: 'Trigram (PostgreSQL): one text field, speeds up "contains" filters on it (case-insensitive, 3 characters or more). The search box checks every text field and sorts by ID, so on large tables it may still scan.',
	index_help_concurrent: 'Create without locking the table: the database keeps accepting writes while the index builds (slower on big tables).',
	index_help_status: 'The index builds in the background: the row shows Creating, then Ready or Failed with the reason. Deleting a field drops its indexes.',
	// Spec 031 (D-212): the Upload extension dialog of Settings > Extensions and the source chip of an uploaded package.
	upload_extension: 'Upload extension',
	upload_extension_copy:
		'Upload a package built with npm pack (.tgz). The extension runs on the server with the rights of the API process; only upload packages you trust.',
	upload_extension_browse: 'Choose a .tgz file',
	upload_extension_drop: 'or drop it here',
	upload_extension_wrong_type: 'Only .tgz or .tar.gz packages are accepted.',
	upload_extension_too_large: 'The file is larger than the upload limit ({max}).',
	upload_extension_success: 'Extension "{name}" installed.',
	upload_extension_submit: 'Upload',
	extension_source_upload: 'Uploaded',
};
