Environment sync pulls configuration from another Backoffice environment into the one you are using, for example from a
test environment pulling the approved configuration from the development environment. The configuration covers the data
model, flows, roles and permissions, settings, translations, global bookmarks, dashboards, indexes, folders and the
enabled or disabled state of extensions. Data (items, files, users) is not copied.

## Who can use it

Admins only. You need the static token of an admin in the source environment.

## Requirements

- Both environments run the same Backoffice version and have the same list of migrations.
- The server of the target environment can reach the source URL.
- The URL and the token are not stored: after reloading the page you have to enter them again.

## Steps

1. Open **Settings** → **Environment Sync**.
2. Enter the **Source URL** and the **Static admin token of the source**; choose the groups to compare.
3. Click **Compare**. The table shows each configuration row with its state: different, only at source, only here, same.
4. Open a row to see the values on both sides field by field.
5. Tick the rows to take over. A row that is only here is ticked to be deleted; rows deleted along with it are ticked
   and locked automatically.
6. Click **Apply**, read the confirmation dialog (the rows that will be deleted, the flows that will run right away) and
   confirm.

![Environment Sync page after a comparison: the groups to compare, the Differences tab and the Data model table with orders only at source and products only here](./images/environment-sync-1.png)

## When something goes wrong

- All the changes of one apply run in a single transaction: if something fails halfway, no row is written.
- If either environment changed after the comparison, the apply is refused; click **Compare again**.
- A change that would remove your own admin access is refused.

> [!WARNING] The source admin token goes through the browser and the target server on every run. Use an `https` URL for
> the source; use `http` only inside a trusted internal network.

## Related

- The target server blocks the addresses in [`IMPORT_IP_DENY_LIST`](/docs/configuration/files#import-from-url).
- API: [compare](/docs/api/backoffice#compare-the-configuration-with-a-source-environment),
  [apply](/docs/api/backoffice#apply-the-selected-rows).
