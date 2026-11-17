The **Content** module is where you work with data day to day: each collection (table) an admin creates in the Data
Model becomes an entry in the menu on the left, and each row of the table is an item you can view, create, edit or
delete. You only see the collections and fields your role is allowed to read.

## Opening the module

1. Click the **Content** tile in the module block at the top of the sidebar.
2. Choose a collection in the menu on the left, for example **Products**. The collection's bookmarks sit right under its
   name.

![Products collection list as a table: columns Product Name, Price, SKU and Status, with the search bar and filter button in the top corner](./images/content-1.png)

## Viewing, searching and filtering

- **Search**: type in the search box in the top corner; the list is filtered on every text field.
- **Filter**: click the **Filter** button, choose **Add Filter**, then pick a field, an operator and a value. Several
  conditions can be combined with "and" and "or" groups.
- **Layout**: open the right sidebar (the **i** button) to switch the layout between table, cards, calendar, kanban and
  map, and to choose columns and sorting.
- **Bookmarks**: after filtering, click the bookmark icon next to the title to save this view under a name; the bookmark
  shows in the menu on the left.

Two kinds of filter that only Backoffice has are described on their own pages:
[filtering by a path in a JSON field](/docs/guides/json-path-filter) and
[comparing two fields](/docs/guides/field-compare-filter).

## Creating, editing and deleting items

1. Click the **+** button in the top corner to create a new item, or click a row to open an item.
2. Fill in the fields of the form. Fields marked with `*` are required.
3. Click the save button (the check mark) in the top corner. The arrow next to the save button offers more ways to save:
   save and create new, save as copy.
4. To delete, open the item and click the trash icon, or select several rows in the list and click delete.

![Item page: form with Status, Product Name, SKU, Price, Stock, Minimum Stock and the JSON field Specs](./images/content-2.png)

The right sidebar of the item page has the edit history (revisions), comments, manually triggered flows and version
comparison.

> [!NOTE] An admin can hide the search box, the import part or the export part of each collection: see
> [Search, Import and Export Toggles](/docs/guides/collection-toggles).

## Related

- API: [list items](/docs/api/items#list-items), [create an item](/docs/api/items#create-an-item).
- Configuration: default and maximum number of items per page in
  [Query and user limits](/docs/configuration/security#query-and-user-limits).
