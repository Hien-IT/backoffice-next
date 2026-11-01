# Contract: Web (D-207.4)

## Tín hiệu bật (`composables/use-passkey-support.ts`)

```ts
/** true khi: trình duyệt có WebAuthn, GET /backoffice/auth/passkey trả 200 và rp_id === location.hostname. */
export function usePasskeySupport(): { passkeyAvailable: Ref<boolean>; ready: Promise<void> };
```

Một promise theo module cho cả phiên app (làm lại khi `setApiUrl`); 404 (Directus) hay lỗi mạng → `false`, không log
lỗi. Dùng ở `LoginForm.vue` và `UserPasskeys.vue`.

## `auth.ts`

```ts
/** Lấy options, gọi navigator.credentials.get qua @simplewebauthn/browser, gửi assertion với mode session, rồi như login(). */
export async function loginWithPasskey(): Promise<void>;
/** Lỗi ném khi người dùng hủy hộp thoại (NotAllowedError): { code: 'PASSKEY_CANCELLED' }; form bỏ qua. */
```

## Màn hình bắt cài TFA (D-207.3, FR-004, phương án E)

Không sửa web: `router/guard.ts` giữ nguyên, đọc `enforce_tfa` từ `GET /policies/me/globals`, mà API trả `false` cho
phiên passkey (contracts/api.md, D-207.5). Directus app dùng cùng session vẫn bắt cài TFA.

## `LoginForm.vue`

| Thành phần | Hành vi |
|------------|---------|
| Nút `BoButton variant="secondary" full-width icon="passkey"` `{{ $t('passkey_sign_in') }}` | dưới form (ngoài `<form>`), `v-if="passkeyAvailable"`; `loading` riêng (`loggingInWithPasskey`); vô hiệu khi form đang gửi và ngược lại |
| Thành công | `router.push(redirectQuery || last_page || '/content')` như mật khẩu |
| Hủy | không đổi gì, focus trở lại nút |
| Lỗi API (`INVALID_CREDENTIALS`, 503) | `BoNotice type="danger"` dùng chung `errorFormatted` |
| Trình duyệt không hỗ trợ, API là Directus, hostname ≠ RP ID | không nút |

## `modules/users/components/UserPasskeys.vue` (+ `composables/use-passkeys.ts`)

Props: `userId: string`, `provider: string | null`, `isCurrentUser: boolean`. Hiện khi `passkeyAvailable && provider ===
'default' && (isCurrentUser || userStore.isAdmin)`; đặt sau `<BoForm>` trong `UserItemRoute.vue` (cùng cột, không trong
card form, layout-patterns §8).

| Phần | Recipe | Ghi chú |
|------|--------|---------|
| Card | `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`; header `px-6 py-5` với `BoIcon passkey`, `h3.text-base.font-medium` `passkeys`, mô tả `passkeys_description`; body `border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800` | `div`, không landmark (như card D-150) |
| Nút thêm | header, `BoButton variant="primary" size="sm" icon="add"` `passkey_add`; chỉ `isCurrentUser`; `disabled` + `aria-describedby` → `passkey_limit` khi 10 | |
| Bảng | `BoTable` cột `name`, `date_created` (`passkey_created`), `last_used` (`passkey_last_used`, `passkey_never_used` khi null), `caption` sr-only `passkeys`; slot `item-append`: của mình → `BoMenu` (`passkey_rename`, `passkey_delete` danger); admin xem người khác → một `BoButton variant="ghost" square icon="delete" :aria-label="$t('passkey_delete')"` | `loading` khi tải; `empty` slot: icon `passkey`, `passkey_none`, `passkey_none_hint` (BoInfo-style) |
| Dialog thêm | `BoDialog` tiêu đề `passkey_add`; bước 1 form `${id}-password`: `BoInput type=password autocomplete=current-password :label="$t('password')" autofocus`, nút `cancel` + submit `next`; sau `startRegistration` bước 2 form `${id}-name`: `BoInput :label="$t('passkey_name')" maxlength 100` giá trị gợi ý `passkey_default_name` ({platform}), nút `cancel` + `save`; lỗi `BoNotice` trong dialog | hủy ở trình duyệt → đóng dialog, không lỗi; Esc đóng, focus về nút thêm (Reka) |
| Dialog đổi tên | `BoDialog` `passkey_rename`, một `BoInput`, `cancel` + `save` | |
| Dialog xóa | `BoDialog` `passkey_delete` với `passkey_delete_confirm` ({name}); admin: thêm `passkey_admin_delete_text`; nút `cancel` (secondary) trước, `delete` (danger) sau (D-76) | focus về trigger (D-197 khi mở từ BoMenu) |
| Sau thao tác | tải lại danh sách; `notify` toast thành công (`D-172`) không bắt buộc, không thêm chuỗi mới nếu dùng `item_update_success`-style có sẵn | |

Trạng thái: default, hover, focus-visible (recipe `FOCUS`), disabled (nút thêm khi 10, nút khi `loading`), loading
(`aria-busy` bảng), invalid (tên rỗng: `invalid` + `error` trên BoInput), empty.

## i18n (overlay en-US + vi-VN, flat, prefix `passkey_`)

| Key | en-US | vi-VN |
|-----|-------|-------|
| `passkey_sign_in` | Sign in with a passkey | Đăng nhập bằng Passkey |
| `passkeys` | Passkeys | Passkey |
| `passkeys_description` | Sign in without a password using Touch ID, Windows Hello, a security key or your password manager. | Đăng nhập không cần mật khẩu bằng Touch ID, Windows Hello, khóa bảo mật hoặc trình quản lý mật khẩu. |
| `passkey_add` | Add passkey | Thêm passkey |
| `passkey_enter_password` | Enter your password to add a passkey | Nhập mật khẩu để thêm passkey |
| `passkey_name` | Name | Tên |
| `passkey_default_name` | Passkey on {platform} | Passkey trên {platform} |
| `passkey_rename` | Rename | Đổi tên |
| `passkey_delete` | Delete passkey | Xóa passkey |
| `passkey_delete_confirm` | Delete "{name}"? You will no longer be able to sign in with it. | Xóa "{name}"? Bạn sẽ không đăng nhập được bằng passkey này nữa. |
| `passkey_admin_delete_text` | The user will have to add a new passkey to sign in without a password again. | Người dùng sẽ phải thêm passkey mới để đăng nhập không mật khẩu. |
| `passkey_none` | No passkeys yet | Chưa có passkey |
| `passkey_none_hint` | Add one to sign in with your fingerprint, face or PIN. If a passkey was deleted here, also remove it from your device. | Thêm một passkey để đăng nhập bằng vân tay, khuôn mặt hoặc PIN. Nếu đã xóa passkey ở đây, hãy xóa cả trong thiết bị. |
| `passkey_limit` | You can have up to 10 passkeys. | Tối đa 10 passkey. |
| `passkey_created` | Created | Ngày tạo |
| `passkey_last_used` | Last used | Lần dùng cuối |
| `passkey_never_used` | Never used | Chưa dùng |

Không key `errors.*` mới (overlay spread nông): lỗi API hiện qua `translateAPIError` với mã có sẵn.

## Danh sách request đóng

Thêm vào `apps/web-e2e/src/helpers/allowed-paths.ts`, `apps/web/src/test-utils/fetch.ts` `KNOWN_REQUESTS` và
`specs/012-backoffice-web-shell/contracts/api-calls.md`: `GET /backoffice/auth/passkey`, `POST
/backoffice/auth/passkey/login/options`, `POST /backoffice/auth/passkey/login`, `GET|POST /backoffice/users/me/passkeys`,
`POST /backoffice/users/me/passkeys/options`, `PATCH|DELETE /backoffice/users/me/passkeys/:id`, `GET
/backoffice/users/:pk/passkeys`, `DELETE /backoffice/users/:pk/passkeys/:id`. `vite.config.ts` `API_PATHS` thêm
`backoffice`. `optimizeDeps.include` thêm `@simplewebauthn/browser` (browser test import).

## Design-system

`design-system/docs/component-specs.md` thêm recipe "Q-xx Passkeys (spec 029)": card + BoTable + BoMenu + hai BoDialog
(mật khẩu, tên) như Q-19 TFA; không component mới; icon `passkey` của Material Symbols. Điểm hỏi design owner (analyze):
icon và cách hiện thời gian (relative như Directus `display-datetime relative`).
