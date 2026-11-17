The **File Library** module holds every uploaded file: images, documents, videos. Files are organised in folders, and
each file has its own page with a preview, title, description, tags and technical information.

## Opening the module

1. Click the **File Library** tile in the module block.
2. Choose a folder in the folder tree in the sidebar, or a special view: **All Files**, **My Files**, **Recent Files**.

![File Library with the Product Photos folder open: three images as cards, and the Documents and Product Photos folder tree in the sidebar](./images/files-1.png)

## Uploading files

1. Open the folder to upload the files into.
2. Drag files from your computer into the list, or click the **+** button and choose files. The upload dialog also lets
   you enter a URL to fetch a file from another address.
3. Wait for the progress bar to finish; the file shows in the folder.

When the server has resumable uploads turned on, a large file that is interrupted halfway continues from where it
stopped.

## Editing and moving files

1. Click a file to open its page.
2. Edit the title, description or tags and click the save button.
3. The **Replace File** button changes the file's content but keeps its ID, so the places that use the file stay
   correct.
4. The move button (the folder icon) moves the file to another folder; the download button saves the file to your
   computer.
5. For images, the edit button (the sliders icon) opens the crop and rotate editor.

![Page of an image file: the preview, the Replace File button and the form with the Title field](./images/files-2.png)

## Folders

- Click **Create Folder** in the sidebar to add a folder; folders can be nested.
- Deleting a folder does not delete its files: they move up to the parent folder.

## Related

- API: [upload a file](/docs/api/files#create-a-file), [list folders](/docs/api/folders#list-folders).
- Configuration: [storage locations](/docs/configuration/files#storage-locations),
  [upload limits](/docs/configuration/files#uploads),
  [resumable uploads](/docs/configuration/files#resumable-uploads-tus),
  [import from URL](/docs/configuration/files#import-from-url).
