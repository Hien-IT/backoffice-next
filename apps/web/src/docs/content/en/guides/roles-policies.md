Permissions in Backoffice have two layers. An **access policy** holds the permissions: which collections may be read,
created, updated or deleted, with which filter and which fields. A **role** groups several policies and is assigned to
users. A user can also be given policies directly.

## Opening the page

1. Click the **Settings** tile in the module block.
2. Choose **User Roles** or **Access Policies** in the sidebar.

## Creating a role

1. On the User Roles page, click the **+** button and set a name and an icon.
2. In the role, add the policies it needs and the users who belong to it.
3. Click save.

![Editor role page: the policy list with Editing and the list of users of the role](./images/roles-policies-1.png)

## Setting permissions in a policy

1. On the Access Policies page, open a policy or create a new one.
2. Turn on the policy's flags if needed: app access, admin access, require two-factor authentication.
3. In the **Permissions** table, add a collection, then click each action cell: **All Access**, **No Access**, or **Use
   Custom** to set a row filter, the fields that may be used and default values.
4. Click save.

![Editing policy page: permissions table with the products row where Read and Update are on, and the Import and Export columns](./images/roles-policies-2.png)

The **Import** and **Export** columns of the permissions table only exist in Backoffice: see
[Import and Export Permissions](/docs/guides/import-export-permissions).

> [!NOTE] The last admin policy cannot be deleted; Backoffice always keeps at least one admin.

## Related

- API: [roles](/docs/api/roles#list-roles), [policies](/docs/api/policies#list-access-policies),
  [permissions](/docs/api/permissions#list-permissions).
