// Spec 033 (FR-034, English amendment 2026-11-18): the language of a screenshot run. `DOCS_LANG=en` takes the English
// pictures (images/en/, app in en-US) with English sample data, on its own database; without it the Vietnamese ones.
// `L(text)` gives the text of the run: the Vietnamese text itself, or its English counterpart below.
export const LANG: 'vi' | 'en' = process.env['DOCS_LANG'] === 'en' ? 'en' : 'vi';
export const LOCALE = LANG === 'en' ? 'en-US' : 'vi-VN';

const EN: Record<string, string> = {
	// Sample data (seed.ts)
	'Trạng thái': 'Status',
	'Đang bán': 'On Sale',
	'Bản nháp': 'Draft',
	'Ngừng bán': 'Discontinued',
	'Tên sản phẩm': 'Product Name',
	'Mã SKU': 'SKU',
	'Giá (đồng)': 'Price (VND)',
	'Tồn kho': 'Stock',
	'Tồn tối thiểu': 'Minimum Stock',
	'Thông số': 'Specs',
	'Áo thun cotton': 'Cotton T-shirt',
	'Áo sơ mi linen': 'Linen Shirt',
	'Quần jean ống đứng': 'Straight-leg Jeans',
	'Váy hoa nhí': 'Floral Dress',
	'Mũ lưỡi trai': 'Baseball Cap',
	'Khăn len': 'Wool Scarf',
	trắng: 'white',
	be: 'beige',
	xanh: 'blue',
	đỏ: 'red',
	đen: 'black',
	xám: 'gray',
	'mùa hè': 'summer',
	hoa: 'floral',
	'phụ kiện': 'accessories',
	'mùa đông': 'winter',
	'Danh mục sản phẩm của cửa hàng': 'Product catalog of the store',
	'Sản phẩm': 'Products',
	'Biên tập': 'Editing',
	'Sửa sản phẩm và file': 'Edit products and files',
	'Biên tập viên': 'Editor',
	'Quản lý danh mục sản phẩm': 'Manage the product catalog',
	Nguyễn: 'Nguyen',
	Trần: 'Tran',
	'Quản lý kho': 'Warehouse Manager',
	'Ảnh sản phẩm': 'Product Photos',
	'Tài liệu': 'Documents',
	'Cảnh báo hàng sắp hết': 'Low Stock Alert',
	'Ghi log khi một sản phẩm được sửa còn ít hơn 5 cái': 'Log when an edited product has fewer than 5 left',
	'Sản phẩm {{$trigger.keys}} sắp hết hàng': 'Product {{$trigger.keys}} is running low',
	'Ghi log': 'Write Log',
	'Kiểm tra tồn kho': 'Check Stock',
	'Bán hàng': 'Sales',
	'Tình hình bán hàng và tồn kho': 'Sales and stock overview',
	'Sản phẩm đang bán': 'Products on Sale',
	'Tổng tồn kho': 'Total Stock',
	'Sắp hết hàng': 'Running Low',
	'{{name}} — còn {{stock}}': '{{name}} — {{stock}} left',
	'Sản phẩm Váy hoa nhí sắp hết hàng': 'Floral Dress is running low',
	'Còn 3 cái, dưới mức tối thiểu 6.': 'Only 3 left, below the minimum of 6.',
	'Đơn hàng': 'Orders',
	'Gửi hóa đơn': 'Send Invoice',
	'Màu đỏ': 'Red',
	'Dưới mức tối thiểu': 'Below Minimum',
	// UI labels the scripts click or wait for (the en-US strings of the app)
	Tạo: 'Create',
	'Bộ lọc': 'Filter',
	'URL nguồn': 'Source URL',
	'Static token admin của nguồn': 'Static admin token of the source',
	'So sánh': 'Compare',
	'Content: tìm kiếm, Import, Export': 'Content: Search, Import, Export',
	Index: 'Indexes',
	'Tải extension lên': 'Upload extension',
	Passkey: 'Passkeys',
};

export function L(text: string): string {
	if (LANG === 'vi') return text;
	const english = EN[text];
	if (english === undefined) throw new Error(`docs-shots: no English for "${text}"`);
	return english;
}
