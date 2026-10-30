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
	// Spec 025 (D-189.3): the import and export columns of the permission matrix, the Formats tab of their drawer and
	// the hint of a cell whose bo_show_* toggle is off.
	import: 'Import',
	export: 'Export',
	bo_formats: 'Formats',
	bo_formats_hint: 'No format selected means every format',
	bo_toggle_off_hint: 'Turned off in Data Model for this collection',
};
