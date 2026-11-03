// Backoffice-only strings, merged over the generated translations/vi-VN.json (spec FR-062).
export default {
	contact_admin_for_link:
		'Hệ thống không gửi email. Hãy liên hệ quản trị viên để nhận liên kết đặt lại mật khẩu hoặc liên kết lời mời.',
	register_not_available_title: 'Không thể đăng ký',
	register_not_available: 'Không thể tự đăng ký tài khoản. Hãy liên hệ quản trị viên để được cấp tài khoản.',
	skip_to_content: 'Chuyển đến nội dung',
	skip_to_navigation: 'Chuyển đến điều hướng',
	links_and_extensions: 'Liên kết và extension',
	more_modules: 'Thêm',
	open_navigation: 'Mở điều hướng',
	open_sidebar: 'Mở thanh bên',
	close_sidebar: 'Đóng thanh bên',
	play_video: 'Phát video nền',
	profile: 'Hồ sơ',
	navigation: 'Điều hướng',
	// Owner 2026-10-28: the handle that resizes the inline sidebar.
	resize_navigation: 'Thay đổi độ rộng thanh điều hướng',
	// D-200: the toggle that makes the project card of the sidebar compact.
	compact_modules: 'Thu gọn khối module',
	pick_color: 'Chọn màu',
	browser_color_picker: 'Bộ chọn của trình duyệt',
	// D-201: the deep color presets of the color picker.
	color_royal_blue: 'Xanh hoàng gia',
	color_ocean: 'Xanh đại dương',
	color_teal: 'Xanh mòng két',
	color_forest: 'Xanh rừng',
	color_burgundy: 'Đỏ rượu vang',
	color_magenta: 'Hồng tím',
	color_burnt_orange: 'Cam cháy',
	// Feature 013: keyboard reorder of sortable lists (D-60), drawers, file previews.
	move_up: 'Lên',
	move_down: 'Xuống',
	indent_item: 'Thụt vào',
	outdent_item: 'Thụt ra',
	item_options: 'Tùy chọn cho {item}',
	moved_to_position: '{item} đã chuyển đến vị trí {position} trên {total}',
	close: 'Đóng',
	image_load_error: 'Không tải được ảnh',
	map_zoom_in: 'Phóng to',
	map_zoom_out: 'Thu nhỏ',
	map_geolocate: 'Tìm vị trí của tôi',
	// Feature 014: keyboard path of the kanban, calendar and manual sort drag and drop (D-69).
	move_left: 'Chuyển trái',
	move_right: 'Chuyển phải',
	move_to_group: 'Chuyển sang nhóm…',
	move_item_to_group: 'Chuyển {item} sang nhóm',
	// Feature 014: sort announcement of the table count line (FR-115b, no DR key).
	table_sorted_asc: 'Sắp theo {field} tăng dần',
	table_sorted_desc: 'Sắp theo {field} giảm dần',
	// Feature 014: label of the save split button menu (recipe Q-8, no DR key).
	more_save_options: 'Tùy chọn lưu khác',
	// Feature 014: name of the card selection checkbox (recipe Q-3, no DR key).
	select_item_key: 'Chọn {item}',
	// Feature 014: map layout controls and keyboard list (recipe Q-6, D-69, no DR key).
	map_box_select: 'Chọn vùng (Shift + kéo)',
	map_items_in_view: 'Các mục đang hiện',
	// Feature 014: tooltip of the comment send button (recipe Q-11, no DR key).
	comment_submit_shortcut: 'Gửi (Ctrl + Enter)',
	// Feature 014: checkbox of the version comparison footer (recipe Q-10, no DR key).
	delete_version_after_promote: 'Xóa “{version}” sau khi áp dụng',
	// Feature 015 (D-88): the DR theme names are shown as Backoffice names (the stored ids keep "DR ..."),
	// so these three keys replace the generated values on purpose.
	theme_directus_default: 'Backoffice Mặc định',
	theme_directus_minimal: 'Backoffice Tối giản',
	theme_directus_colormatch: 'Backoffice Khớp màu',
	// Feature 015 (D-88, CHK042): note under the system-theme list.
	theme_applies_in_directus: 'Theme được lưu vào hồ sơ. Giao diện Backoffice không đổi.',
	// Feature 017 (D-106).
	operations_mail_not_sent_notice: 'Backoffice không gửi email. Operation này chỉ ghi log và trả kết quả thành công.',
	// Feature 017 (FR-106).
	flow_operation_not_linked: 'Không nối tới trigger',
	flow_run_failed: 'Thất bại',
	// Feature 018 (FR-070).
	notifications_unread_count: 'Thông báo, {count} chưa đọc',
	// Data Model (owner 2026-10-21).
	drop_collections_here: 'Kéo collection vào đây',
	// Bell panel (owner 2026-10-21).
	notifications_mark_read: 'Đánh dấu đã xem',
	notifications_mark_all_read: 'Đánh dấu tất cả đã xem',
	notifications_view_all: 'Xem tất cả',
	// VEmojiPicker shim (spec 020): name of the icon-only button (DR has none).
	insert_emoji: 'Chèn emoji',
	// Spec 020: the nav label of the v-pagination shim of app extensions.
	pagination: 'Phân trang',
	// Spec 022 (D-182): the card title of the bo_show_* toggles in the Data Model collection form.
	collection_content_toggles: 'Content: tìm kiếm, Import, Export',
	// Spec 023 (D-187): the JSON path entry of the Content filter (field list item, form, type names, error).
	json_path: 'Đường dẫn JSON',
	json_path_type_text: 'Chữ',
	json_path_type_number: 'Số',
	json_path_type_boolean: 'Đúng/Sai',
	json_path_invalid: 'Đường dẫn JSON không hợp lệ. Ví dụ: Amount, items[0].sku, items[*].sku',
	json_path_apply: 'Áp dụng',
	// Spec 028 (D-206): the field picker of a filter value ($FIELD(b)) on the Content page.
	field_compare: 'So với field khác',
	field_compare_with: 'So với {field}',
	field_compare_value: 'Nhập giá trị',
	field_compare_missing: 'Không có field {field}',
	// Spec 025 (D-189.3): the import and export columns of the permission matrix, the Formats tab of their drawer and
	// the hint of a cell whose bo_show_* toggle is off.
	import: 'Import',
	export: 'Export',
	bo_formats: 'Định dạng',
	bo_formats_hint: 'Không chọn định dạng nào nghĩa là mọi định dạng',
	bo_toggle_off_hint: 'Đã tắt trong Data Model của collection này',
	// Spec 029 (D-207.4): the passkey button of the login form and the Passkeys card of the user page.
	passkey_sign_in: 'Đăng nhập bằng Passkey',
	passkeys: 'Passkey',
	passkeys_description:
		'Đăng nhập không cần mật khẩu bằng Touch ID, Windows Hello, khóa bảo mật hoặc trình quản lý mật khẩu.',
	passkey_add: 'Thêm passkey',
	passkey_enter_password: 'Nhập mật khẩu để thêm passkey',
	passkey_name: 'Tên',
	passkey_name_title: 'Đặt tên cho passkey',
	passkey_default_name: 'Passkey trên {platform}',
	passkey_rename: 'Đổi tên',
	passkey_delete: 'Xóa passkey',
	passkey_delete_confirm: 'Xóa "{name}"? Bạn sẽ không đăng nhập được bằng passkey này nữa.',
	passkey_admin_delete_text: 'Người dùng sẽ phải thêm passkey mới để đăng nhập không mật khẩu.',
	passkey_none: 'Chưa có passkey',
	passkey_none_hint:
		'Thêm một passkey để đăng nhập bằng vân tay, khuôn mặt hoặc PIN. Nếu đã xóa passkey ở đây, hãy xóa cả trong thiết bị.',
	passkey_limit: 'Tối đa 10 passkey.',
	passkey_created: 'Ngày tạo',
	passkey_last_used: 'Lần dùng cuối',
	passkey_never_used: 'Chưa dùng',
	passkey_actions: 'Thao tác với passkey',
	passkey_already_registered: 'Thiết bị này đã có passkey cho tài khoản của bạn.',
	// Spec 030 (D-210.4): card Indexes của trang collection và hộp thoại xóa field.
	indexes: 'Index',
	indexes_description: 'Index ghép và index tìm kiếm của collection này, do Backoffice tạo.',
	add_index: 'Thêm index',
	index_fields_add: 'Thêm field…',
	index_type: 'Loại index',
	index_type_btree: 'B-tree',
	index_type_trigram: 'Trigram (tìm kiếm, PostgreSQL)',
	index_unique_label: 'Unique: từ chối tổ hợp trùng',
	index_concurrent: 'Tạo không khóa bảng',
	index_status_creating: 'Đang tạo…',
	index_status_ready: 'Sẵn sàng',
	index_status_failed: 'Thất bại',
	index_missing: 'Không còn trên DB',
	index_delete_confirm: 'Xóa index "{name}"?',
	index_created_notice: 'Đang tạo index "{name}"',
	index_ready_notice: 'Index "{name}" đã sẵn sàng',
	index_failed_notice: 'Index "{name}" thất bại: {error}',
	indexes_dropped_with_field: 'Các index sau sẽ bị gỡ:',
	indexes_empty: 'Chưa có index',
};
