// Backoffice (spec 033, FR-030): the groups of the Configuration part of the documentation area, one page each. Only
// the id, title and lead live here (the left menu needs them), in Vietnamese and in English (`en`); the rows are in
// variables.ts and variables.en.ts, loaded with the page.
import type { ConfigGroupMeta } from '../types.ts';

export const configGroups: ConfigGroupMeta[] = [
	{
		id: 'general',
		title: 'Chung',
		lead: 'Địa chỉ, cổng, URL công khai, máy chủ HTTP và tài khoản admin đầu tiên.',
		en: { title: 'General', lead: 'Address, port, public URL, HTTP server and the first admin account.' },
	},
	{
		id: 'database',
		title: 'Cơ sở dữ liệu',
		lead: 'Kết nối tới cơ sở dữ liệu và thư mục migration.',
		en: { title: 'Database', lead: 'The database connection and the migrations folder.' },
	},
	{
		id: 'redis-cache',
		title: 'Redis và cache',
		lead: 'Kết nối Redis, cache trả lời, cache schema và đồng bộ giữa các instance.',
		en: {
			title: 'Redis and Cache',
			lead: 'The Redis connection, response cache, schema cache and sync between instances.',
		},
	},
	{
		id: 'security',
		title: 'Bảo mật và giới hạn',
		lead: 'Khóa bí mật, header bảo mật, CORS, giới hạn tần suất, giới hạn tải và giới hạn truy vấn.',
		en: {
			title: 'Security and Limits',
			lead: 'Secret keys, security headers, CORS, rate limits, load limits and query limits.',
		},
	},
	{
		id: 'auth',
		title: 'Xác thực và SSO',
		lead: 'Thời hạn token, cookie phiên, và các nhà cung cấp đăng nhập OAuth 2.0, OpenID Connect, LDAP.',
		en: {
			title: 'Authentication and SSO',
			lead: 'Token lifetimes, session cookies and the OAuth 2.0, OpenID Connect and LDAP sign-in providers.',
		},
	},
	{
		id: 'files',
		title: 'File và lưu trữ',
		lead: 'Nơi lưu file, giới hạn upload, upload nối tiếp, biến đổi ảnh và import từ URL.',
		en: {
			title: 'Files and Storage',
			lead: 'Where files are stored, upload limits, resumable uploads, image transforms and import from URL.',
		},
	},
	{
		id: 'flows-extensions',
		title: 'Flows và extension',
		lead: 'Giới hạn của flow, nơi đặt extension, sandbox và marketplace.',
		en: { title: 'Flows and Extensions', lead: 'Flow limits, where extensions live, the sandbox and the marketplace.' },
	},
	{
		id: 'data',
		title: 'Import, export và lưu giữ',
		lead: 'Import, export dữ liệu và dọn activity, revision, log của flow theo lịch.',
		en: {
			title: 'Import, Export and Retention',
			lead: 'Data import and export, and the scheduled clean-up of activity, revisions and flow logs.',
		},
	},
	{
		id: 'graphql-realtime',
		title: 'GraphQL và realtime',
		lead: 'Giới hạn của GraphQL và các công tắc realtime.',
		en: { title: 'GraphQL and Realtime', lead: 'GraphQL limits and the realtime switches.' },
	},
	{
		id: 'logging-metrics',
		title: 'Log và metrics',
		lead: 'Mức log, dạng log và endpoint metrics cho hệ thống giám sát.',
		en: { title: 'Logs and Metrics', lead: 'Log level, log format and the metrics endpoint for monitoring.' },
	},
];
