# Quickstart: GraphQL (011)

## Chạy app mới

```bash
pnpm install
pnpm nx run api:serve
```

Đặt `.env` như Directus (cùng `DB_*`, `SECRET`, `REDIS`, `CACHE_*`, `GRAPHQL_*`).

## Thử nhanh

```bash
curl -s -X POST http://localhost:8055/graphql -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  -d '{"query":"{ articles(limit: 2) { id title category { name } } articles_aggregated { count { id } } }"}'
```

```bash
curl -s -X POST http://localhost:8055/graphql/system -H 'Content-Type: application/json' \
  -d '{"query":"mutation { auth_login(email: \"admin@example.com\", password: \"...\") { access_token } }"}'
```

```bash
curl -s -o schema.graphql -D - http://localhost:8055/server/specs/graphql/system -H 'Authorization: Bearer <token>'
```

Introspection: `POST /graphql` với query `getIntrospectionQuery()` của `graphql`; so với Directus bằng
`tests/parity/src/graphql/helpers.ts` (`introspection`).

## Kiểm tra

```bash
pnpm nx run api:test
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,cache-redis,graphql-nointro
```

```bash
PARITY_SUITE=full pnpm nx run parity-tests:test -- src/graphql
```

```bash
PARITY_SUITE=blackbox PARITY_BLACKBOX_APP=backoffice pnpm nx run parity-tests:test
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup && pnpm nx run directus-app-e2e:test -- graphql.spec.ts routing.spec.ts
```

```bash
pnpm nx run benchmark:env-up && pnpm nx run benchmark:graphql
```

## Đo trước khi viết (research R12)

Trên Directus của môi trường đối chiếu (`http://127.0.0.1:8155`):

```bash
for m in OPTIONS HEAD PUT; do curl -s -o /dev/null -w "$m %{http_code} %header{allow}\n" -X $m http://127.0.0.1:8155/graphql; done
```

```bash
curl -s -X POST http://127.0.0.1:8155/graphql -H 'Content-Type: application/json' -d '{"query":"subscription { articles_mutated { key } }"}'
```

```bash
curl -s -X POST http://127.0.0.1:8155/graphql -H 'Content-Type: application/json' -d '{"query":"{ __schema { queryType { name } } }"}'
```

Ghi kết quả vào research.md R12 kèm ngày.
