For a JSON field, the filter of the Content module can filter on a value inside the JSON, for example the color in the
Specs field `{"color": "red", "weight": 260}`.

## Who can use it

Every user who can read that JSON field. The filter works on the collection page and in the item picker drawer.

## Steps

1. Open the collection in the **Content** module.
2. Click **Filter**, then **Add Filter**.
3. In the field list, open the JSON field and choose its JSON path entry.
4. Enter the path, for example `color` or `size.width`; use `tags[*]` to match when any element of the array meets the
   condition.
5. Choose the value type: text, number or boolean. The type decides which operators are available.
6. Choose the operator and enter the value.

![Products collection filtered on Specs › color (Text) Equals red: one item left, Floral Dress](./images/json-path-filter-1.png)

Save the filter as a bookmark to use it again.

## Through the API

The filter key has the form `json(field, path, type)`, for example:

```json
{ "json(specs, color)": { "_eq": "red" } }
```

See [list items](/docs/api/items#list-items).

## Limits

- Only works on PostgreSQL and SQLite; other databases return an error.
- It cannot be used in the permissions of a policy.
