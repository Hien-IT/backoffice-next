The **Data Model** (in Settings) is where admins create collections and fields. Each collection is a table in the
database; each field is a column, together with how it is entered (interface) and shown (display) in the app.

## Opening the page

1. Click the **Settings** tile in the module block.
2. Choose **Data Model** in the sidebar.

![Data Model page: list of collections with products, and the system collections group at the end](./images/data-model-1.png)

## Creating a collection

1. Click the **+** button, enter the collection name (lowercase, no accents, with underscores) and choose the primary
   key type.
2. Choose the system fields you want ready-made (status, user created, date created...) and save.
3. Drag the collection to set its order in the Content menu, or move it into a folder.

## Adding and editing fields

1. Click a collection to open its page.
2. Click **Create Field**, choose a type (text, number, date, JSON, relation...), give it a name, then configure the
   interface, the display and the constraints.
3. Drag fields to change their order on the form; choose half or full width.
4. Click a field to edit it; the field's menu has a delete command. Deleting a field also deletes its column and data.

![products collection page: the fields id, status, name, sku, price, stock, min_stock and specs, with the Indexes card and the settings cards](./images/data-model-2.png)

Below the field list are the collection's settings cards: display, translations, archive, sort, and two cards that only
Backoffice has: [Indexes](/docs/guides/collection-indexes) and
[Content: Search, Import, Export](/docs/guides/collection-toggles).

> [!WARNING] Deleting a collection deletes the table and all the data in it. This cannot be undone.

## Related

- API: [collections](/docs/api/collections#list-collections), [fields](/docs/api/fields#list-all-fields).
