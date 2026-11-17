Besides the marketplace, an admin can install an extension from a `.tgz` package on their computer (a package made with
`npm pack`), for example an extension written by your team.

## Who can use it

Admins only.

## Steps

1. Package the extension: run `npm pack` in the extension's folder.
2. Open **Settings** → **Extensions**.
3. Click **Upload extension** in the top corner.
4. Drag the `.tgz` file into the box, or click **Choose a .tgz file**.
5. Click **Upload**. The extension shows in the list with the **Uploaded** label.

![Upload extension dialog: drop area with the Choose a .tgz file button, and the Cancel and Upload buttons](./images/extension-upload-1.png)

## What the server checks

- The package is well formed and its name is not already used by another extension.
- When `MARKETPLACE_TRUST` is `sandbox` (the default), only extensions that run in the sandbox or only in the app are
  accepted.
- The number of extensions does not exceed `EXTENSIONS_LIMIT`; the package does not exceed `FILES_MAX_UPLOAD_SIZE`.

See [extension configuration](/docs/configuration/flows-extensions#extensions) and
[marketplace](/docs/configuration/flows-extensions#marketplace).

## Removing and reinstalling

Remove an extension with the menu of its row. To install a new version, remove the old one and upload the new package.

> [!WARNING] Extensions run on the server. Only upload packages you trust.

## Related

- API:
  [install an extension from an uploaded package](/docs/api/backoffice#install-an-extension-from-an-uploaded-package).
