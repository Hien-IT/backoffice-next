// Backoffice (spec 033, FR-030): the groups of the Configuration part of the documentation area, one page each. Only
// the id, title and lead live here (the left menu needs them); the rows are in variables.ts, loaded with the page.
import type { ConfigGroupMeta } from '../types.ts';

export const configGroups: ConfigGroupMeta[] = [
	{
		id: 'general',
		title: 'Chung',
		lead: 'Địa chỉ, cổng, URL công khai, máy chủ HTTP và tài khoản admin đầu tiên.',
	},
	{
		id: 'database',
		title: 'Cơ sở dữ liệu',
		lead: 'Kết nối tới cơ sở dữ liệu và thư mục migration.',
	},
	{
		id: 'redis-cache',
		title: 'Redis và cache',
		lead: 'Kết nối Redis, cache trả lời, cache schema và đồng bộ giữa các instance.',
	},
	{
		id: 'security',
		title: 'Bảo mật và giới hạn',
		lead: 'Khóa bí mật, header bảo mật, CORS, giới hạn tần suất, giới hạn tải và giới hạn truy vấn.',
	},
	{
		id: 'auth',
		title: 'Xác thực và SSO',
		lead: 'Thời hạn token, cookie phiên, và các nhà cung cấp đăng nhập OAuth 2.0, OpenID Connect, LDAP.',
	},
	{
		id: 'files',
		title: 'File và lưu trữ',
		lead: 'Nơi lưu file, giới hạn upload, upload nối tiếp, biến đổi ảnh và import từ URL.',
	},
	{
		id: 'flows-extensions',
		title: 'Flows và extension',
		lead: 'Giới hạn của flow, nơi đặt extension, sandbox và marketplace.',
	},
	{
		id: 'data',
		title: 'Import, export và lưu giữ',
		lead: 'Import, export dữ liệu và dọn activity, revision, log của flow theo lịch.',
	},
	{
		id: 'graphql-realtime',
		title: 'GraphQL và realtime',
		lead: 'Giới hạn của GraphQL và các công tắc realtime.',
	},
	{
		id: 'logging-metrics',
		title: 'Log và metrics',
		lead: 'Mức log, dạng log và endpoint metrics cho hệ thống giám sát.',
	},
];
