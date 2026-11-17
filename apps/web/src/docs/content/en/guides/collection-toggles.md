An admin can hide the search box, the import part and the export part of each collection in the Content module. When a
part is hidden, the server also refuses the matching action through the API, for everyone including admins.

## Who can use it

Only admins can change this setting. The setting applies to every user of the collection.

## Turning it on or off

1. Open **Settings** → **Data Model** and choose the collection.
2. Scroll down to the **Content: Search, Import, Export** card.
3. Uncheck **Show Search**, **Show Import** or **Show Export**.
4. Click save in the top corner.

![Content: Search, Import, Export card of the products collection with the three options Show Search, Show Import and Show Export all turned on](./images/collection-toggles-1.png)

## Effect

- **Search off**: the collection page has no search box (the filter button stays); the API answers with a permission
  error when a request has the `search` parameter, in both REST and GraphQL.
- **Import off**: the sidebar has no import part; the API refuses to import files into this collection.
- **Export off**: the export part and the CSV download link are gone; the API refuses to export this collection.

## Limits

- The setting is per collection, not per role. To let some people import or export and not others, use
  [import and export permissions per policy](/docs/guides/import-export-permissions).
- The error returned is the same as the no-permission error, so it does not reveal whether the collection exists.
