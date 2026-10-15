# @backoffice/web

The Backoffice admin app (Vue 3, Reka UI, Tailwind CSS 4 on the `design-system/` tokens). It replaces the Directus app
and talks only to the Directus REST API (specs/012-backoffice-web-shell/contracts/api-calls.md), so the same build runs
against Directus 11.17.4 or the Backoffice API.

## Configuration

One image for every environment. At start the container writes `/admin/config.json` from `PUBLIC_URL`
(`docker/40-config.sh`); the app reads `apiUrl` from it at run time.

| Variable     | Meaning                                                                  | Example                        |
| ------------ | ------------------------------------------------------------------------ | ------------------------------ |
| `PUBLIC_URL` | Base URL of the API (`/` when the API is on the same origin as `/admin`) | `/`, `https://api.example.com` |

No other variable. In development `apps/web/public/config.json` holds `{ "apiUrl": "/" }` and the Vite dev server
proxies every API path to `PUBLIC_URL` (default `http://127.0.0.1:8055`).

## Deployment

### Same origin (recommended)

A reverse proxy sends `/admin/` to the web container (nginx on port 8080) and every other path to the API
(`PUBLIC_URL=/`). The session cookie of the API (`directus_session_token`, session mode like the Directus app) works
without extra settings. See `tests/parity/proxy/web-api.conf`.

### Another origin

The app keeps session mode: every request is sent with `credentials: 'include'`. The API must allow it:

| API variable                          | Value                                                       |
| ------------------------------------- | ----------------------------------------------------------- |
| `CORS_ENABLED`                        | `true`                                                      |
| `CORS_ORIGIN`                         | the origin of the app, e.g. `https://admin.example.com`     |
| `CORS_CREDENTIALS`                    | `true`                                                      |
| `SESSION_COOKIE_SAME_SITE`            | `None`                                                      |
| `SESSION_COOKIE_SECURE`               | `true`                                                      |
| `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` | `https://admin.example.com/admin/login` (each SSO provider) |
| `AUTH_ALLOWED_PUBLIC_URLS`            | the public URLs of the API when it has more than one        |

Browsers accept `SameSite=None` cookies only with `Secure`, so both sites need HTTPS (browsers make an exception for
`localhost` and `127.0.0.1`, which the E2E `cors` configuration uses). Without these variables sign-in succeeds but the
next requests answer `401`.

## Translations

`src/lang/translations/{en-US,vi-VN}.json` are generated from `directus/app/src/lang` (11.17.4) with Directus rebranded
to Backoffice, and committed:

```bash
pnpm nx run web:sync-translations
```

Backoffice-only strings live in `src/lang/overlay/`. `scripts/sync-translations.test.ts` fails when the committed files
differ from the source.

## Checks

```bash
pnpm nx run web:lint          # ESLint, raw colors (tools/check-raw-colors.mjs), no visible "Directus" (scripts/check-brand.mjs)
pnpm nx run web:typecheck
pnpm nx run web:test          # Vitest projects `unit` (happy-dom) and `browser` (chromium), coverage >= 60%
pnpm nx run web:check-bundle  # entry chunk within the 013 budget, editors and map only in lazy chunks
```

The `browser` project needs chromium once: `pnpm exec playwright install chromium` (from `apps/web`).

## Interface and display fixtures

`fixtures/interfaces/` holds the fixture set that the component tests read (feature 013): seed it into Directus or the
Backoffice API with `pnpm nx run web:fixtures -- --api <url> --email <admin> --password <password>`, see
`fixtures/interfaces/README.md`.

## E2E (apps/web-e2e)

```bash
docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:local .
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web
cd apps/web-e2e
E2E_CONFIG=proxy-directus pnpm exec playwright test   # app -> Directus 11.17.4 (http://127.0.0.1:8161)
E2E_CONFIG=proxy-api pnpm exec playwright test        # app -> Backoffice API (http://127.0.0.1:8162)
E2E_CONFIG=cors pnpm exec playwright test             # app http://localhost:8181 -> API http://127.0.0.1:8163
```

## Map tiles and third-party editors

- The map interface uses OpenStreetMap raster tiles by default (attribution `© OpenStreetMap contributors`), like
  Directus. The OSM tile servers have a usage policy (https://operations.osmfoundation.org/policies/tiles/): for real
  traffic set your own `basemaps` (or `mapbox_key`) in the project settings.
- The rich text (HTML) interface is not installed yet: TinyMCE 6.8.6 (the Directus version) has high XSS advisories
  fixed only in the GPL TinyMCE 7 (specs/013-interfaces-displays/research.md R1). Fields configured with it fall back to
  the default interface of their type (a textarea).

## Attributions

- Brand icons of the icon picker's Social group and of `BoIcon` brand names:
  [Font Awesome Free](https://fontawesome.com) 6.7.2 (`@fortawesome/free-brands-svg-icons`), icons under CC BY 4.0, code
  under MIT (https://fontawesome.com/license/free).
