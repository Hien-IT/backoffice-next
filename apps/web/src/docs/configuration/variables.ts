// Backoffice (spec 033, FR-030..FR-033): the hand-written half of the Configuration part: for every entry of
// supported.generated.json one row with what the variable does and the kind of value it takes. Defaults are not written
// here; the page shows them from the generated file. variables.test.ts fails when an entry has no row, a row has no
// entry, or a variable sits in two groups. The other system on the same database is never named (FR-047): write "hệ
// thống dùng chung cơ sở dữ liệu".
import type { ConfigRow, ConfigTable } from '../types.ts';

const SHARED = 'Phải trùng với hệ thống dùng chung cơ sở dữ liệu, nếu có.';

/** A variable with a plain name. */
const v = (name: string, description: string, note?: string): ConfigRow => ({
	name,
	pattern: name,
	description,
	...(note ? { note } : {}),
});

/** A family of variables: `name` is what the reader types, `pattern` the entry of the generated file. */
const p = (name: string, pattern: string, description: string, note?: string): ConfigRow => ({
	name,
	pattern,
	description,
	...(note ? { note } : {}),
});

export const configTables: Record<string, ConfigTable[]> = {
	general: [
		{
			title: 'Chung',
			rows: [
				v('CONFIG_PATH', 'Đường dẫn tới file cấu hình (`.env`, `.json`, `.yaml` hoặc `.js`). Chuỗi đường dẫn.'),
				v('HOST', 'Địa chỉ IP hoặc tên máy mà API lắng nghe.'),
				v('PORT', 'Cổng API lắng nghe. Số nguyên.'),
				v(
					'PUBLIC_URL',
					'URL mà người dùng dùng để tới API. Dùng cho chuyển hướng khi đăng nhập SSO, cookie và passkey. URL hoặc đường dẫn.',
					'Passkey chỉ bật khi giá trị là URL tuyệt đối có tên miền (không phải địa chỉ IP).',
				),
				v(
					'ROOT_REDIRECT',
					'Nơi chuyển hướng khi mở đường dẫn gốc `/`. Đường dẫn tương đối, URL, hoặc `false` để không chuyển hướng.',
				),
				v('OPENAPI_ENABLED', 'Bật tài liệu OpenAPI ở `/server/specs/oas`. Đúng hoặc sai.'),
				v('ROBOTS_TXT', 'Nội dung trả về ở `/robots.txt`. Chuỗi nhiều dòng.'),
				v('TEMP_PATH', 'Thư mục chứa file tạm của API, ví dụ file đang upload. Chuỗi đường dẫn.'),
				v('MAX_PAYLOAD_SIZE', 'Kích thước tối đa của thân request. Chuỗi kích thước như `1mb`, `512kb`.'),
				v('QUERYSTRING_MAX_PARSE_DEPTH', 'Độ sâu tối đa khi phân tích tham số query lồng nhau. Số nguyên.'),
				v('QUERYSTRING_ARRAY_LIMIT', 'Số phần tử tối đa của một mảng trong query string. Số nguyên.'),
				v(
					'PACKAGE_FILE_LOCATION',
					'Thư mục chứa `package.json` mà API đọc để tìm extension được cài như gói npm. Chuỗi đường dẫn.',
				),
			],
		},
		{
			title: 'Máy chủ HTTP',
			rows: [
				p(
					'SERVER_*',
					'SERVER_.+',
					'Tùy chọn của máy chủ HTTP. Thường dùng: `SERVER_KEEP_ALIVE_TIMEOUT` và `SERVER_HEADERS_TIMEOUT` (mili giây), `SERVER_SHUTDOWN_TIMEOUT` (mili giây chờ các request đang chạy khi tắt).',
					'Đặt `SERVER_KEEP_ALIVE_TIMEOUT` lớn hơn thời gian chờ của load balancer đứng trước.',
				),
			],
		},
		{
			title: 'Tài khoản admin đầu tiên',
			note: 'Chỉ được đọc khi khởi tạo cơ sở dữ liệu (lệnh `bootstrap`) hoặc khi gọi thiết lập lần đầu. Thiếu `ADMIN_EMAIL` hoặc `ADMIN_PASSWORD` thì không user admin nào được tạo.',
			rows: [
				v('ADMIN_EMAIL', 'Email của user admin được tạo khi khởi tạo. Địa chỉ email.'),
				v('ADMIN_PASSWORD', 'Mật khẩu của user admin đó. Chuỗi.'),
				v('ADMIN_TOKEN', 'Static token gán cho user admin đó. Chuỗi.'),
				v('PROJECT_OWNER', 'Email của chủ dự án, ghi vào cài đặt dự án khi migration chạy lần đầu. Địa chỉ email.'),
				v('ACCEPT_TERMS', 'Ghi nhận việc chấp nhận điều khoản sử dụng khi khởi tạo cơ sở dữ liệu. Đúng hoặc sai.'),
			],
		},
	],

	database: [
		{
			title: 'Kết nối',
			rows: [
				p(
					'DB_*',
					'DB_.+',
					'Kết nối cơ sở dữ liệu. `DB_CLIENT` chọn loại (`pg`, `mysql`, `sqlite3`, `mssql`, `oracledb`, `cockroachdb`); `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` cho máy chủ; `DB_FILENAME` cho SQLite; `DB_CONNECTION_STRING` thay cho các biến riêng lẻ; `DB_POOL__MIN`, `DB_POOL__MAX` cho pool kết nối; `DB_SSL__*` cho TLS. Biến `DB_*` khác được chuyển thẳng cho driver.',
					'Khi chạy cạnh hệ thống dùng chung cơ sở dữ liệu, các biến này phải trỏ tới cùng một cơ sở dữ liệu. Lệnh `bootstrap`, `install` và `migrate` chỉ chạy trên PostgreSQL và SQLite.',
				),
			],
		},
		{
			title: 'Migration',
			rows: [v('MIGRATIONS_PATH', 'Thư mục chứa migration tùy biến của dự án. Chuỗi đường dẫn.')],
		},
	],

	'redis-cache': [
		{
			title: 'Redis',
			note: 'Chạy nhiều instance thì bắt buộc có Redis: bus truyền tin, khóa phân tán, cache và bộ đếm dùng chung đều nằm ở đây.',
			rows: [
				v('REDIS', 'Chuỗi kết nối Redis dạng `redis://user:password@host:port/db`. Thay cho các biến `REDIS_*` riêng lẻ.'),
				v('REDIS_ENABLED', 'Bật dùng Redis. Đúng hoặc sai; để trống thì tự bật khi có `REDIS` hoặc `REDIS_HOST`.'),
				v('REDIS_HOST', 'Tên máy hoặc địa chỉ IP của Redis.'),
				v('REDIS_PORT', 'Cổng của Redis. Số nguyên.'),
				v('REDIS_USERNAME', 'Tên đăng nhập Redis. Chuỗi.'),
				v('REDIS_PASSWORD', 'Mật khẩu Redis. Chuỗi.'),
				v('REDIS_DB', 'Số thứ tự cơ sở dữ liệu của Redis. Số nguyên.'),
				v('REDIS_BUS_NAMESPACE', 'Namespace của kênh truyền tin giữa các instance. Chuỗi; để trống là `directus:bus`.', SHARED),
				v('REDIS_LOCK_NAMESPACE', 'Namespace của khóa phân tán. Chuỗi; để trống thì dùng mặc định của API.', SHARED),
				v('REDIS_PERMISSIONS_NAMESPACE', 'Namespace của cache phân quyền. Chuỗi; để trống là `permissions`.', SHARED),
			],
		},
		{
			title: 'Cache trả lời',
			rows: [
				v('CACHE_ENABLED', 'Bật cache cho trả lời của các request đọc. Đúng hoặc sai.'),
				v('CACHE_TTL', 'Thời gian sống của một trả lời trong cache. Chuỗi thời lượng như `5m`, `1h`.'),
				v('CACHE_NAMESPACE', 'Tiền tố khóa của cache. Chuỗi.', SHARED),
				v('CACHE_STORE', 'Nơi lưu cache: `memory` hoặc `redis`. Nhiều instance thì dùng `redis`.'),
				v('CACHE_AUTO_PURGE', 'Tự xóa cache trả lời mỗi khi có thao tác ghi. Đúng hoặc sai.'),
				v(
					'CACHE_AUTO_PURGE_IGNORE_LIST',
					'Các collection mà thao tác ghi không làm xóa cache. Danh sách tên cách nhau bằng dấu phẩy.',
				),
				v('CACHE_STATUS_HEADER', 'Tên header báo trả lời lấy từ cache (`HIT`) hay không (`MISS`). Chuỗi; để trống là không gửi.'),
				v('CACHE_VALUE_MAX_SIZE', 'Kích thước tối đa của một trả lời được đưa vào cache. Chuỗi kích thước như `10mb`, hoặc `false` để không giới hạn.'),
				v('CACHE_SKIP_ALLOWED', 'Cho phép client bỏ qua cache bằng header `Cache-Control: no-store`. Đúng hoặc sai.'),
				v('CACHE_CONTROL_S_MAXAGE', 'Giá trị `s-maxage` trong header `Cache-Control` của trả lời. Số giây.'),
				v('CACHE_HEALTHCHECK_THRESHOLD', 'Ngưỡng mà trên đó health check coi cache là chậm. Số mili giây; để trống là 150.'),
			],
		},
		{
			title: 'Cache schema và hệ thống',
			rows: [
				v('CACHE_SCHEMA', 'Giữ schema của cơ sở dữ liệu trong bộ nhớ thay vì đọc lại ở mỗi request. Đúng hoặc sai.'),
				v('CACHE_SCHEMA_MAX_ITERATIONS', 'Số lần thử tối đa khi chờ một instance khác dựng xong schema. Số nguyên.'),
				v('CACHE_SCHEMA_SYNC_TIMEOUT', 'Thời gian chờ tối đa cho việc đó. Số mili giây.'),
				v(
					'CACHE_SCHEMA_FREEZE_ENABLED',
					'Đóng băng đối tượng schema trong bộ nhớ thay vì sao chép cho mỗi request. Đúng hoặc sai.',
					'Nhanh hơn, nhưng extension sửa trực tiếp đối tượng schema sẽ lỗi.',
				),
				v('CACHE_SYSTEM_TTL', 'Thời gian sống của cache hệ thống (schema, phân quyền). Chuỗi thời lượng; để trống là không hết hạn.'),
				v('CACHE_DEPLOYMENT_TTL', 'Thời gian sống của cache dữ liệu triển khai. Chuỗi thời lượng; để trống là 5 giây.'),
			],
		},
		{
			title: 'Đồng bộ giữa các instance',
			rows: [
				v('SYNCHRONIZATION_STORE', 'Nơi lưu dữ liệu đồng bộ: `memory` hoặc `redis`. Nhiều instance thì dùng `redis`.'),
				v('SYNCHRONIZATION_NAMESPACE', 'Tiền tố khóa của dữ liệu đồng bộ. Chuỗi.', SHARED),
			],
		},
	],

	security: [
		{
			title: 'Khóa và header',
			rows: [
				v(
					'SECRET',
					'Chuỗi bí mật dùng để ký token. Chuỗi ngẫu nhiên dài.',
					`Phải giống nhau ở mọi instance. ${SHARED} Không đặt thì mỗi lần khởi động có một giá trị mới và mọi phiên đăng nhập mất hiệu lực.`,
				),
				v('IP_TRUST_PROXY', 'Tin header của reverse proxy khi xác định địa chỉ IP của client. Đúng, sai, hoặc giá trị `trust proxy` của Express.'),
				v('IP_CUSTOM_HEADER', 'Tên header chứa địa chỉ IP của client. Chuỗi, hoặc `false` để không dùng.'),
				p(
					'CONTENT_SECURITY_POLICY_*',
					'CONTENT_SECURITY_POLICY_.+',
					'Tùy biến header `Content-Security-Policy`, ví dụ `CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_ANCESTORS`.',
				),
				v('CROSS_ORIGIN_OPENER_POLICY_ENABLED', 'Gửi header `Cross-Origin-Opener-Policy`. Đúng hoặc sai.'),
				v('CROSS_ORIGIN_OPENER_POLICY', 'Giá trị của header đó. Chuỗi.'),
				p('HSTS_*', 'HSTS_.+', 'Header `Strict-Transport-Security`: `HSTS_ENABLED` để bật, các biến `HSTS_*` khác là tùy chọn của header.'),
				p(
					'HASH_*',
					'HASH_.+',
					'Tùy chọn của thuật toán băm mật khẩu argon2: `HASH_MEMORY_COST`, `HASH_LENGTH`, `HASH_TIME_COST`, `HASH_PARALLELISM`, `HASH_TYPE`, `HASH_ASSOCIATED_DATA`.',
					SHARED,
				),
			],
		},
		{
			title: 'CORS',
			rows: [
				v('CORS_ENABLED', 'Bật header CORS. Cần khi app web và API ở hai origin khác nhau. Đúng hoặc sai.'),
				v('CORS_ORIGIN', 'Origin được phép. `true` (lấy theo header `Origin` của request), `false`, hoặc danh sách origin cách nhau bằng dấu phẩy.'),
				v('CORS_METHODS', 'Các method được phép. Danh sách cách nhau bằng dấu phẩy.'),
				v('CORS_ALLOWED_HEADERS', 'Các header request được phép. Danh sách cách nhau bằng dấu phẩy.'),
				v('CORS_EXPOSED_HEADERS', 'Các header trả lời mà trình duyệt được đọc. Danh sách cách nhau bằng dấu phẩy.'),
				v('CORS_CREDENTIALS', 'Cho phép gửi cookie trong request khác origin. Đúng hoặc sai.'),
				v('CORS_MAX_AGE', 'Thời gian trình duyệt được nhớ kết quả preflight. Số giây.'),
			],
		},
		{
			title: 'Giới hạn tần suất và tải',
			rows: [
				p(
					'RATE_LIMITER_*',
					'RATE_LIMITER_(?!EMAIL_).+',
					'Giới hạn số request theo địa chỉ IP: `RATE_LIMITER_ENABLED`, `RATE_LIMITER_POINTS` (số request), `RATE_LIMITER_DURATION` (số giây), `RATE_LIMITER_STORE` (`memory` hoặc `redis`). `RATE_LIMITER_GLOBAL_*` giới hạn tổng số request; `RATE_LIMITER_REGISTRATION_*` giới hạn đăng ký.',
					'Nhiều instance thì dùng `redis` để bộ đếm chung.',
				),
				v('PRESSURE_LIMITER_ENABLED', 'Từ chối request bằng mã 503 khi máy chủ quá tải. Đúng hoặc sai.'),
				v('PRESSURE_LIMITER_SAMPLE_INTERVAL', 'Khoảng cách giữa hai lần đo tải. Số mili giây.'),
				v('PRESSURE_LIMITER_MAX_EVENT_LOOP_UTILIZATION', 'Mức sử dụng event loop tối đa. Số từ 0 tới 1.'),
				v('PRESSURE_LIMITER_MAX_EVENT_LOOP_DELAY', 'Độ trễ event loop tối đa. Số mili giây.'),
				v('PRESSURE_LIMITER_MAX_MEMORY_RSS', 'Bộ nhớ RSS tối đa. Số byte, hoặc `false` để không kiểm.'),
				v('PRESSURE_LIMITER_MAX_MEMORY_HEAP_USED', 'Bộ nhớ heap đã dùng tối đa. Số byte, hoặc `false` để không kiểm.'),
				v('PRESSURE_LIMITER_RETRY_AFTER', 'Giá trị header `Retry-After` gửi kèm mã 503. Số giây, hoặc `false` để không gửi.'),
			],
		},
		{
			title: 'Giới hạn truy vấn và người dùng',
			rows: [
				v('MAX_BATCH_MUTATION', 'Số item tối đa trong một thao tác tạo, sửa hoặc xóa hàng loạt. Số nguyên.'),
				v('MAX_RELATIONAL_DEPTH', 'Độ sâu quan hệ tối đa trong một truy vấn. Số nguyên.'),
				v('QUERY_LIMIT_DEFAULT', 'Số item trả về khi request không nêu `limit`. Số nguyên.'),
				v('QUERY_LIMIT_MAX', 'Giá trị `limit` lớn nhất được phép. Số nguyên; để trống là không giới hạn.'),
				v('RELATIONAL_BATCH_SIZE', 'Số dòng mỗi lô khi đọc dữ liệu quan hệ. Số nguyên.'),
				v('MAX_JSON_QUERY_DEPTH', 'Độ sâu tối đa của path trong hàm `json()` của truy vấn. Số nguyên.'),
				v('USERS_ADMIN_ACCESS_LIMIT', 'Số user đang hoạt động tối đa có quyền admin. Số nguyên.'),
				v('USERS_APP_ACCESS_LIMIT', 'Số user đang hoạt động tối đa có quyền vào app (không phải admin). Số nguyên.'),
				v('USERS_API_ACCESS_LIMIT', 'Số user đang hoạt động tối đa chỉ có quyền API. Số nguyên.'),
			],
		},
	],

	auth: [
		{
			title: 'Token và cookie',
			rows: [
				v('ACCESS_TOKEN_TTL', 'Thời hạn của access token. Chuỗi thời lượng như `15m`.'),
				v('REFRESH_TOKEN_TTL', 'Thời hạn của refresh token. Chuỗi thời lượng như `7d`.'),
				v('REFRESH_TOKEN_COOKIE_NAME', 'Tên cookie chứa refresh token. Chuỗi.', SHARED),
				v('REFRESH_TOKEN_COOKIE_DOMAIN', 'Tên miền của cookie đó. Chuỗi; để trống là tên miền của API.'),
				v('REFRESH_TOKEN_COOKIE_SECURE', 'Chỉ gửi cookie đó qua HTTPS. Đúng hoặc sai.'),
				v('REFRESH_TOKEN_COOKIE_SAME_SITE', 'Thuộc tính `SameSite` của cookie đó: `lax`, `strict` hoặc `none`.'),
				v('SESSION_COOKIE_NAME', 'Tên cookie phiên của app web. Chuỗi.', SHARED),
				v('SESSION_COOKIE_TTL', 'Thời hạn của phiên đăng nhập. Chuỗi thời lượng như `1d`.'),
				v('SESSION_COOKIE_DOMAIN', 'Tên miền của cookie phiên. Chuỗi; để trống là tên miền của API.'),
				v('SESSION_COOKIE_SECURE', 'Chỉ gửi cookie phiên qua HTTPS. Đúng hoặc sai.'),
				v(
					'SESSION_COOKIE_SAME_SITE',
					'Thuộc tính `SameSite` của cookie phiên: `lax`, `strict` hoặc `none`.',
					'App web và API ở hai site khác nhau thì cần `none` cùng `SESSION_COOKIE_SECURE` bật.',
				),
				v(
					'SESSION_REFRESH_GRACE_PERIOD',
					'Thời gian phiên cũ còn dùng được sau khi được làm mới, để các request gửi cùng lúc không bị từ chối. Chuỗi thời lượng như `10s`.',
				),
				v('LOGIN_STALL_TIME', 'Thời gian tối thiểu của một lần đăng nhập, để không lộ thông tin qua thời gian trả lời. Số mili giây.'),
				v('REGISTER_STALL_TIME', 'Thời gian tối thiểu của một lần đăng ký. Số mili giây.'),
			],
		},
		{
			title: 'Link mời, đặt lại mật khẩu và đăng ký',
			note: 'Backoffice không gửi email: link được ghi vào log để quản trị viên chuyển cho người dùng.',
			rows: [
				v('PASSWORD_RESET_URL_ALLOW_LIST', 'Các URL được dùng làm trang đặt lại mật khẩu. Danh sách URL cách nhau bằng dấu phẩy.'),
				v('USER_INVITE_TOKEN_TTL', 'Thời hạn của link mời. Chuỗi thời lượng như `7d`.'),
				v('USER_INVITE_URL_ALLOW_LIST', 'Các URL được dùng làm trang nhận lời mời. Danh sách URL cách nhau bằng dấu phẩy.'),
				v('USER_REGISTER_URL_ALLOW_LIST', 'Các URL được dùng làm trang xác nhận đăng ký. Danh sách URL cách nhau bằng dấu phẩy.'),
				v('EMAIL_VERIFICATION_TOKEN_TTL', 'Thời hạn của link xác nhận email. Chuỗi thời lượng như `7d`.'),
			],
		},
		{
			title: 'Nhà cung cấp đăng nhập',
			note: 'Trong tên biến, `<PROVIDER>` là tên nhà cung cấp viết hoa, lấy từ `AUTH_PROVIDERS`.',
			rows: [
				v('AUTH_PROVIDERS', 'Tên các nhà cung cấp đăng nhập ngoài. Danh sách cách nhau bằng dấu phẩy, ví dụ `google,ldap`.'),
				v('AUTH_DISABLE_DEFAULT', 'Tắt đăng nhập bằng email và mật khẩu. Đúng hoặc sai.'),
				v(
					'AUTH_ALLOWED_PUBLIC_URLS',
					'Các URL công khai khác của API được dùng làm địa chỉ quay về khi đăng nhập SSO, ngoài `PUBLIC_URL`. Danh sách URL cách nhau bằng dấu phẩy.',
				),
				p('AUTH_<PROVIDER>_DRIVER', 'AUTH_.+_DRIVER', 'Loại nhà cung cấp: `oauth2`, `openid` hoặc `ldap`.'),
				p('AUTH_<PROVIDER>_LABEL', 'AUTH_.+_LABEL', 'Tên hiện trên nút đăng nhập. Chuỗi.'),
				p('AUTH_<PROVIDER>_ICON', 'AUTH_.+_ICON', 'Icon hiện trên nút đăng nhập. Tên icon.'),
				p(
					'AUTH_<PROVIDER>_ALLOW_PUBLIC_REGISTRATION',
					'AUTH_.+_ALLOW_PUBLIC_REGISTRATION',
					'Tự tạo user khi một người đăng nhập lần đầu qua nhà cung cấp này. Đúng hoặc sai.',
				),
				p('AUTH_<PROVIDER>_DEFAULT_ROLE_ID', 'AUTH_.+_DEFAULT_ROLE_ID', 'Role gán cho user được tự tạo. Mã định danh của role.'),
				p(
					'AUTH_<PROVIDER>_SYNC_USER_INFO',
					'AUTH_.+_SYNC_USER_INFO',
					'Cập nhật họ tên và email của user theo nhà cung cấp ở mỗi lần đăng nhập. Đúng hoặc sai.',
				),
				p(
					'AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST',
					'AUTH_.+_REDIRECT_ALLOW_LIST',
					'Các URL được phép chuyển hướng tới sau khi đăng nhập. Danh sách URL cách nhau bằng dấu phẩy.',
				),
				p('AUTH_<PROVIDER>_COOKIE_SECURE', 'AUTH_.+_COOKIE_SECURE', 'Chỉ gửi cookie tạm của vòng đăng nhập SSO qua HTTPS. Đúng hoặc sai.'),
			],
		},
		{
			title: 'OAuth 2.0 và OpenID Connect',
			rows: [
				p('AUTH_<PROVIDER>_CLIENT_ID', 'AUTH_.+_CLIENT_ID', 'Client ID do nhà cung cấp cấp. Chuỗi.'),
				p('AUTH_<PROVIDER>_CLIENT_SECRET', 'AUTH_.+_CLIENT_SECRET', 'Client secret do nhà cung cấp cấp. Chuỗi.'),
				p('AUTH_<PROVIDER>_SCOPE', 'AUTH_.+_SCOPE', 'Các scope xin khi đăng nhập. Danh sách cách nhau bằng dấu cách.'),
				p('AUTH_<PROVIDER>_AUTHORIZE_URL', 'AUTH_.+_AUTHORIZE_URL', 'URL trang cấp quyền của nhà cung cấp (OAuth 2.0). URL.'),
				p('AUTH_<PROVIDER>_ACCESS_URL', 'AUTH_.+_ACCESS_URL', 'URL đổi mã lấy token (OAuth 2.0). URL.'),
				p('AUTH_<PROVIDER>_PROFILE_URL', 'AUTH_.+_PROFILE_URL', 'URL đọc hồ sơ người dùng (OAuth 2.0). URL.'),
				p('AUTH_<PROVIDER>_ISSUER_URL', 'AUTH_.+_ISSUER_URL', 'URL tài liệu khám phá của nhà cung cấp (OpenID Connect). URL.'),
				p(
					'AUTH_<PROVIDER>_ISSUER_DISCOVERY_MUST_SUCCEED',
					'AUTH_.+_ISSUER_DISCOVERY_MUST_SUCCEED',
					'API không khởi động khi không đọc được tài liệu khám phá. Đúng hoặc sai.',
				),
				p('AUTH_<PROVIDER>_IDENTIFIER_KEY', 'AUTH_.+_IDENTIFIER_KEY', 'Trường của hồ sơ dùng làm định danh duy nhất của user. Tên trường.'),
				p('AUTH_<PROVIDER>_EMAIL_KEY', 'AUTH_.+_EMAIL_KEY', 'Trường của hồ sơ chứa email. Tên trường.'),
				p('AUTH_<PROVIDER>_FIRST_NAME_KEY', 'AUTH_.+_FIRST_NAME_KEY', 'Trường của hồ sơ chứa tên. Tên trường.'),
				p('AUTH_<PROVIDER>_LAST_NAME_KEY', 'AUTH_.+_LAST_NAME_KEY', 'Trường của hồ sơ chứa họ. Tên trường.'),
				p('AUTH_<PROVIDER>_PARAMS', 'AUTH_.+_PARAMS', 'Tham số thêm vào URL cấp quyền. Đối tượng JSON.'),
				p(
					'AUTH_<PROVIDER>_REQUIRE_VERIFIED_EMAIL',
					'AUTH_.+_AUTH_REQUIRE_VERIFIED_EMAIL',
					'Chỉ nhận user mà nhà cung cấp báo email đã xác minh (OpenID Connect). Đúng hoặc sai.',
				),
				p(
					'AUTH_<PROVIDER>_CLIENT_HTTP_*',
					'AUTH_.+_CLIENT_HTTP_.+',
					'Tùy chọn của kết nối HTTP tới nhà cung cấp, ví dụ thời gian chờ.',
				),
			],
		},
		{
			title: 'LDAP',
			rows: [
				p('AUTH_<PROVIDER>_CLIENT_URL', 'AUTH_.+_CLIENT_URL', 'URL của máy chủ LDAP, ví dụ `ldaps://ldap.example.com`. URL.'),
				p('AUTH_<PROVIDER>_BIND_DN', 'AUTH_.+_BIND_DN', 'DN của tài khoản mà API dùng để tìm user. Chuỗi DN.'),
				p('AUTH_<PROVIDER>_BIND_PASSWORD', 'AUTH_.+_BIND_PASSWORD', 'Mật khẩu của tài khoản đó. Chuỗi.'),
				p('AUTH_<PROVIDER>_USER_DN', 'AUTH_.+_USER_DN', 'Nhánh của thư mục chứa user. Chuỗi DN.'),
				p('AUTH_<PROVIDER>_USER_ATTRIBUTE', 'AUTH_.+_USER_ATTRIBUTE', 'Thuộc tính dùng làm tên đăng nhập. Tên thuộc tính.'),
				p('AUTH_<PROVIDER>_USER_SCOPE', 'AUTH_.+_USER_SCOPE', 'Phạm vi tìm user: `base`, `one` hoặc `sub`.'),
				p('AUTH_<PROVIDER>_MAIL_ATTRIBUTE', 'AUTH_.+_MAIL_ATTRIBUTE', 'Thuộc tính chứa email. Tên thuộc tính.'),
				p('AUTH_<PROVIDER>_FIRST_NAME_ATTRIBUTE', 'AUTH_.+_FIRST_NAME_ATTRIBUTE', 'Thuộc tính chứa tên. Tên thuộc tính.'),
				p('AUTH_<PROVIDER>_LAST_NAME_ATTRIBUTE', 'AUTH_.+_LAST_NAME_ATTRIBUTE', 'Thuộc tính chứa họ. Tên thuộc tính.'),
				p('AUTH_<PROVIDER>_GROUP_DN', 'AUTH_.+_GROUP_DN', 'Nhánh của thư mục chứa nhóm, dùng để gán role theo nhóm. Chuỗi DN.'),
				p('AUTH_<PROVIDER>_GROUP_ATTRIBUTE', 'AUTH_.+_GROUP_ATTRIBUTE', 'Thuộc tính của nhóm chứa thành viên. Tên thuộc tính.'),
				p('AUTH_<PROVIDER>_GROUP_SCOPE', 'AUTH_.+_GROUP_SCOPE', 'Phạm vi tìm nhóm: `base`, `one` hoặc `sub`.'),
			],
		},
	],

	files: [
		{
			title: 'Nơi lưu trữ',
			note: 'Trong tên biến, `<LOCATION>` là tên nơi lưu viết hoa, lấy từ `STORAGE_LOCATIONS`. Backoffice hỗ trợ hai driver: `local` và `s3`.',
			rows: [
				v('STORAGE_LOCATIONS', 'Tên các nơi lưu file. Danh sách cách nhau bằng dấu phẩy; nơi đầu tiên là mặc định.', SHARED),
				p('STORAGE_<LOCATION>_DRIVER', 'STORAGE_.+_DRIVER', 'Driver của nơi lưu: `local` hoặc `s3`.'),
				p('STORAGE_<LOCATION>_ROOT', 'STORAGE_.+_ROOT', 'Thư mục gốc chứa file (`local`), hoặc tiền tố khóa trong bucket (`s3`). Chuỗi đường dẫn.'),
				p('STORAGE_<LOCATION>_KEY', 'STORAGE_.+_KEY', 'Access key của S3. Chuỗi.'),
				p('STORAGE_<LOCATION>_SECRET', 'STORAGE_.+_SECRET', 'Secret key của S3. Chuỗi.'),
				p('STORAGE_<LOCATION>_BUCKET', 'STORAGE_.+_BUCKET', 'Tên bucket của S3. Chuỗi.'),
				p('STORAGE_<LOCATION>_REGION', 'STORAGE_.+_REGION', 'Region của S3. Chuỗi.'),
				p('STORAGE_<LOCATION>_ENDPOINT', 'STORAGE_.+_ENDPOINT', 'Endpoint của dịch vụ tương thích S3. URL.'),
				p('STORAGE_<LOCATION>_ACL', 'STORAGE_.+_ACL', 'ACL gán cho file khi ghi lên S3. Chuỗi như `private`.'),
				p(
					'STORAGE_<LOCATION>_SERVER_SIDE_ENCRYPTION',
					'STORAGE_.+_SERVER_SIDE_ENCRYPTION',
					'Kiểu mã hóa phía máy chủ của S3. Chuỗi như `AES256` hoặc `aws:kms`.',
				),
				p(
					'STORAGE_<LOCATION>_SERVER_SIDE_ENCRYPTION_KMS_KEY_ID',
					'STORAGE_.+_SERVER_SIDE_ENCRYPTION_KMS_KEY_ID',
					'Khóa KMS dùng cho mã hóa đó. Mã định danh của khóa.',
				),
				p(
					'STORAGE_<LOCATION>_HEALTHCHECK_THRESHOLD',
					'STORAGE_.+_HEALTHCHECK_THRESHOLD',
					'Ngưỡng mà trên đó health check coi nơi lưu là chậm. Số mili giây.',
				),
			],
		},
		{
			title: 'Upload',
			rows: [
				v('FILES_MAX_UPLOAD_SIZE', 'Kích thước tối đa của một file upload. Chuỗi kích thước như `100mb`; để trống là không giới hạn.'),
				v('FILES_MAX_UPLOAD_CONCURRENCY', 'Số file được xử lý cùng lúc trong một request upload. Số nguyên.'),
				v('FILES_MIME_TYPE_ALLOW_LIST', 'Các loại file được phép upload. Danh sách mẫu MIME cách nhau bằng dấu phẩy, ví dụ `image/*,application/pdf`.'),
				v(
					'FILES_CONTENT_TYPE_ALLOW_LIST',
					'Được chấp nhận để không sinh cảnh báo, nhưng API không đọc. Dùng `FILES_MIME_TYPE_ALLOW_LIST`.',
				),
				v('FILES_DELETE_ORIGINAL_ON_MOVE', 'Xóa file ở nơi lưu cũ khi một file được chuyển sang nơi lưu khác. Đúng hoặc sai.'),
				v('FILE_METADATA_ALLOW_LIST', 'Các trường metadata của ảnh (EXIF, IPTC) được giữ lại khi upload. Danh sách cách nhau bằng dấu phẩy, hoặc `*` cho tất cả.'),
			],
		},
		{
			title: 'Upload nối tiếp (TUS)',
			rows: [
				v('TUS_ENABLED', 'Bật upload nối tiếp cho file lớn: upload bị ngắt thì tiếp tục được. Đúng hoặc sai.'),
				v('TUS_CHUNK_SIZE', 'Kích thước mỗi phần của một upload. Số byte.'),
				v('TUS_UPLOAD_EXPIRATION', 'Thời gian giữ một upload dang dở trước khi bị dọn. Chuỗi thời lượng như `10m`.'),
				v('TUS_CLEANUP_SCHEDULE', 'Lịch dọn upload dang dở đã hết hạn. Biểu thức cron.'),
			],
		},
		{
			title: 'Ảnh và asset',
			rows: [
				v('ASSETS_CACHE_TTL', 'Thời gian trình duyệt được giữ một asset. Chuỗi thời lượng như `30d`.'),
				v('ASSETS_CACHE_REVALIDATE', 'Yêu cầu trình duyệt hỏi lại máy chủ trước khi dùng bản đã giữ. Đúng hoặc sai.'),
				v('ASSETS_TRANSFORM_MAX_CONCURRENT', 'Số ảnh được biến đổi cùng lúc. Số nguyên.'),
				v('ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION', 'Chiều rộng hoặc cao tối đa của ảnh gốc được phép biến đổi. Số điểm ảnh.'),
				v('ASSETS_TRANSFORM_MAX_OPERATIONS', 'Số phép biến đổi tối đa trong một request. Số nguyên.'),
				v('ASSETS_TRANSFORM_TIMEOUT', 'Thời gian tối đa của một lần biến đổi. Chuỗi thời lượng như `7500ms`.'),
				v('ASSETS_CONTENT_SECURITY_POLICY', 'Header `Content-Security-Policy` riêng cho trả lời của `/assets`. Chuỗi.'),
				v(
					'ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL',
					'Mức lỗi của file ảnh mà từ đó phép biến đổi bị từ chối: `none`, `truncated`, `error` hoặc `warning`.',
				),
			],
		},
		{
			title: 'Import từ URL',
			rows: [
				v(
					'IMPORT_IP_DENY_LIST',
					'Các địa chỉ IP mà API không được gọi tới khi import file từ URL và khi đồng bộ môi trường. Danh sách cách nhau bằng dấu phẩy.',
					'`0.0.0.0` chặn mọi địa chỉ của chính máy chủ. Thêm dải mạng nội bộ nếu không muốn admin gọi được vào đó.',
				),
			],
		},
	],

	'flows-extensions': [
		{
			title: 'Flows',
			rows: [
				v('FLOWS_ENV_ALLOW_LIST', 'Các biến môi trường mà flow đọc được qua `$env`. Danh sách tên cách nhau bằng dấu phẩy, hoặc `false` để không cho biến nào.'),
				v('FLOWS_RUN_SCRIPT_MAX_MEMORY', 'Bộ nhớ tối đa của operation Run Script. Số megabyte.'),
				v('FLOWS_RUN_SCRIPT_TIMEOUT', 'Thời gian chạy tối đa của operation Run Script. Số mili giây.'),
				p(
					'RATE_LIMITER_EMAIL_FLOWS_*',
					'RATE_LIMITER_EMAIL_FLOWS_.+',
					'Giới hạn tần suất của operation Send Email: `RATE_LIMITER_EMAIL_FLOWS_ENABLED`, `_POINTS`, `_DURATION`.',
					'Backoffice không gửi email: operation chạy đủ các bước và ghi log thay cho việc gửi.',
				),
			],
		},
		{
			title: 'Extension',
			rows: [
				v('EXTENSIONS_PATH', 'Thư mục chứa extension trên máy. Chuỗi đường dẫn.'),
				v(
					'EXTENSIONS_LOCATION',
					'Tên nơi lưu (trong `STORAGE_LOCATIONS`) chứa extension dùng chung cho mọi instance. Chuỗi.',
					'Cần khi chạy nhiều instance: extension cài từ marketplace hoặc tải lên được đồng bộ từ đây.',
				),
				v('EXTENSIONS_MUST_LOAD', 'API dừng khởi động khi một extension không nạp được. Đúng hoặc sai.'),
				v('EXTENSIONS_AUTO_RELOAD', 'Tự nạp lại extension khi file của nó đổi. Chỉ dùng khi phát triển. Đúng hoặc sai.'),
				v('EXTENSIONS_CACHE_TTL', 'Thời gian trình duyệt được giữ gói extension của app. Chuỗi thời lượng; để trống là không giữ.'),
				v('EXTENSIONS_SANDBOX_MEMORY', 'Bộ nhớ tối đa của một extension chạy trong sandbox. Số megabyte.'),
				v('EXTENSIONS_SANDBOX_TIMEOUT', 'Thời gian chạy tối đa của một lần gọi trong sandbox. Số mili giây.'),
				v('EXTENSIONS_LIMIT', 'Số extension tối đa được cài. Số nguyên; để trống là không giới hạn.'),
				v('EXTENSIONS_ROLLDOWN', 'Dùng Rolldown thay cho Rollup khi đóng gói extension của app. Đúng hoặc sai.'),
			],
		},
		{
			title: 'Marketplace',
			rows: [
				v('MARKETPLACE_REGISTRY', 'URL của registry mà trang Marketplace dùng. URL; để trống là registry mặc định.'),
				v(
					'MARKETPLACE_TRUST',
					'Loại extension được cài từ marketplace hoặc tải lên: `sandbox` (chỉ extension chạy trong sandbox) hoặc `all`.',
				),
			],
		},
	],

	data: [
		{
			title: 'Import và export',
			rows: [
				v('IMPORT_TIMEOUT', 'Thời gian tối đa của một lần import. Chuỗi thời lượng như `1h`.'),
				v('IMPORT_MAX_CONCURRENCY', 'Số lần import được chạy cùng lúc trên toàn hệ thống. Số nguyên.'),
				v('IMPORT_EXPORT_NAMESPACE', 'Namespace Redis của bộ đếm import, export. Chuỗi.', SHARED),
				v('MAX_IMPORT_ERRORS', 'Số lỗi tối đa được ghi lại trước khi một lần import dừng. Số nguyên.'),
				v('EXPORT_BATCH_SIZE', 'Số item mỗi lô khi export ra file. Số nguyên.'),
			],
		},
		{
			title: 'Lưu giữ dữ liệu',
			note: 'Một job theo lịch xóa activity, revision và log của flow cũ. Chạy nhiều instance thì mỗi lượt chỉ một instance chạy.',
			rows: [
				v('RETENTION_ENABLED', 'Bật job dọn dữ liệu cũ. Đúng hoặc sai.'),
				v('RETENTION_SCHEDULE', 'Lịch chạy của job. Biểu thức cron.'),
				v('RETENTION_BATCH', 'Số dòng xóa trong mỗi lô. Số nguyên.'),
				v('ACTIVITY_RETENTION', 'Thời gian giữ activity. Chuỗi thời lượng như `90d`, hoặc `false` để giữ mãi.'),
				v('REVISIONS_RETENTION', 'Thời gian giữ revision. Chuỗi thời lượng như `90d`, hoặc `false` để giữ mãi.'),
				v('FLOW_LOGS_RETENTION', 'Thời gian giữ log của flow. Chuỗi thời lượng như `90d`, hoặc `false` để giữ mãi.'),
			],
		},
	],

	'graphql-realtime': [
		{
			title: 'GraphQL',
			rows: [
				v('GRAPHQL_INTROSPECTION', 'Cho phép truy vấn introspection. Đúng hoặc sai.'),
				v('GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT', 'Số schema GraphQL được dựng cùng lúc. Số nguyên.'),
				v('GRAPHQL_QUERY_TOKEN_LIMIT', 'Số token tối đa của một truy vấn GraphQL. Số nguyên.'),
				v('GRAPHQL_SCHEMA_CACHE_CAPACITY', 'Số schema theo user được giữ trong bộ nhớ. Số nguyên; để trống là 100.'),
			],
		},
		{
			title: 'Realtime',
			note: 'Backoffice không mở kết nối WebSocket. Các biến này chỉ bật việc phát sự kiện thay đổi dữ liệu lên bus dùng chung, để hệ thống dùng chung cơ sở dữ liệu đẩy tới client của nó.',
			rows: [
				v('WEBSOCKETS_ENABLED', 'Bật phát sự kiện realtime lên bus. Đúng hoặc sai.'),
				v('WEBSOCKETS_REST_ENABLED', 'Phát sự kiện cho kênh REST. Đúng hoặc sai.'),
				v('WEBSOCKETS_GRAPHQL_ENABLED', 'Phát sự kiện cho kênh GraphQL; giá trị này cũng được báo ở `/server/info`. Đúng hoặc sai.'),
			],
		},
	],

	'logging-metrics': [
		{
			title: 'Log',
			rows: [
				v('LOG_LEVEL', 'Mức log thấp nhất được ghi: `fatal`, `error`, `warn`, `info`, `debug`, `trace` hoặc `silent`. Để trống là `info`.'),
				v('LOG_STYLE', 'Dạng log: `pretty` (cho người đọc) hoặc `raw` (JSON, cho hệ thống thu log). Để trống là `pretty`.'),
				v('LOG_HTTP_IGNORE_PATHS', 'Các đường dẫn mà request tới đó không được ghi log, ví dụ `/server/ping`. Danh sách cách nhau bằng dấu phẩy.'),
				p('LOGGER_*', 'LOGGER_.+', 'Tùy chọn thêm của bộ ghi log, ví dụ `LOGGER_LEVELS` để đổi tên mức log.'),
			],
		},
		{
			title: 'Metrics',
			rows: [
				v('METRICS_ENABLED', 'Bật endpoint `/metrics` định dạng Prometheus. Đúng hoặc sai.'),
				v('METRICS_SCHEDULE', 'Lịch thu thập số liệu. Biểu thức cron.'),
				v('METRICS_TOKENS', 'Token được phép đọc `/metrics`, gửi trong header `Authorization: Metrics <token>`. Danh sách cách nhau bằng dấu phẩy; để trống thì chỉ admin đọc được.'),
				v('METRICS_SERVICES', 'Các dịch vụ được đo: `database`, `cache`, `redis`, `storage`. Danh sách cách nhau bằng dấu phẩy.'),
				v('METRICS_HEALTH_CHECK_PREFIX', 'Tiền tố của khóa và file mà phép đo ghi tạm. Chuỗi.'),
				v('METRICS_NAME_PREFIX', 'Tiền tố của tên metric. Chuỗi.', 'Giữ mặc định để dashboard giám sát dùng chung được cho mọi hệ thống trên cùng cơ sở dữ liệu.'),
			],
		},
	],
};
