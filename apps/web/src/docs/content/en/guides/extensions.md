**Extensions** add features to Backoffice: new interfaces and displays for fields, new panels for dashboards, new
modules, new operations for flows, and endpoints and hooks on the server. The Extensions page lists the installed
extensions, grouped by type.

## Opening the page

1. Click the **Settings** tile in the module block.
2. Choose **Extensions** in the sidebar.

![Extensions page: the Panels group with the extension parity-panel-counter version 1.0.0, with the Uploaded and Enabled labels](./images/extensions-1.png)

## Enabling, disabling and removing

1. Click the menu (three dots) at the end of the extension's row.
2. Choose disable or enable. A disabled extension does not run and is not shown in the app.
3. For an extension installed from the marketplace or uploaded, the menu also has a remove command.

## Installing an extension

- From the **Marketplace** in the sidebar: find the extension, open its page and click install.
- From a `.tgz` package on your computer: see [Extension Upload](/docs/guides/extension-upload).

> [!WARNING] Extensions run on the server with the permissions of the API process. Only install extensions you trust.

## Related

- Configuration: [extension folders, sandbox and limits](/docs/configuration/flows-extensions#extensions),
  [marketplace](/docs/configuration/flows-extensions#marketplace).
- API: [list extensions](/docs/api/extensions#list-extensions).
