Indexes help the database find and sort rows quickly in large collections. Backoffice lets an admin create composite
indexes on several fields and search indexes for `?search=`, right from the collection page, without going into the
database.

## Who can use it

Admins only.

## Creating an index

1. Open **Settings** → **Data Model** and choose the collection.
2. In the **Indexes** card, click **Add index**.
3. Choose 1 to 8 fields, starting with the column that is filtered on most often.
4. Choose the type: **B-tree** for filtering and sorting; **Trigram (contains, PostgreSQL)** for text search (PostgreSQL
   only, one text field). Check **Unique** if a combination of values must not repeat.
5. Click create. The index is built in the background; its status changes from creating to ready.

![Indexes card of the products collection: one index products_status_stock_index on Status and Stock, type B-tree](./images/collection-indexes-1.png)

## Notes

- By default the index is built without locking the table (PostgreSQL, MySQL), so the app stays usable while it builds.
- `?search=` searches every text field: each field needs its own trigram index.
- Deleting a field also deletes the indexes that contain it; the confirmation dialog lists them.
- A unique index makes writes with duplicate values fail with a duplicate error.

## Related

- API: [list indexes](/docs/api/backoffice#list-the-indexes-of-a-collection),
  [create an index](/docs/api/backoffice#create-an-index-on-a-collection).
