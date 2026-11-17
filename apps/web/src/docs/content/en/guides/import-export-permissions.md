Besides read, create, update and delete, every access policy has two more permissions per collection: **Import** and
**Export**. People without them do not see the import and export parts in the Content module, and the server refuses
those actions.

## Who can use it

Admins set the permissions. Admins can always import and export.

## Setting the permissions

1. Open **Settings** → **Access Policies** and choose the policy.
2. In the **Permissions** table, find the collection's row.
3. Click the **Import** or **Export** cell and choose:
   - **All Access**: import or export every row and every field;
   - **No Access**: not allowed;
   - **Use Custom**: set a row filter, the fields that may be used and the file formats (CSV, JSON, XML, YAML).
4. Save the policy.

![Permissions table of the Editing policy: the menu of the Export cell in the products row with the three choices All Access, No Access and Use Custom](./images/import-export-permissions-1.png)

## How it is evaluated

- Each policy keeps its own filter, fields and formats. An import row is valid when it fully matches one rule; an import
  file with a row outside the filter or a column outside the allowed fields is refused as a whole.
- An export only returns the rows and fields the person may both read and export.
- If an admin has [turned off Import or Export for the collection](/docs/guides/collection-toggles), nobody can do it,
  even with the permission.

## Limits

- New users have no import or export permission until an admin grants it.
- Import and export permissions do not apply to share links.

## Related

- API: [import and export permissions](/docs/api/backoffice#list-import-and-export-permissions),
  [import](/docs/api/utilities#import-items), [export](/docs/api/utilities#export-items).
