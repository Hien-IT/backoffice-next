**Flows** automate work: when an event happens (an item is created or updated, a schedule fires, a webhook is called, or
a user clicks a button), the flow runs a chain of steps (operations) such as checking a condition, reading or writing
data, calling a URL or sending a notification.

## Opening the page

1. Click the **Settings** tile in the module block.
2. Choose **Flows** in the sidebar. The table lists the flows with their active or inactive status.

## Creating a flow

1. Click the **+** button and set a name and an icon.
2. Choose the trigger type: event, schedule (a cron expression), webhook, manual, or called from another flow; fill in
   the options of that type (for example the collection and the event type).
3. Save to open the flow's canvas.

## Adding steps

1. On the canvas, click the edit button (the pencil icon).
2. Click the connection point of a step, choose an operation type and fill in its options. The green line is the success
   path, the red line the failure path.
3. Drag the steps to arrange them on the grid.
4. Click save; all the changes of the editing session are written at once.

![Canvas of the Low Stock Alert flow: triggered when a product is updated, the Check Stock step, then the Write Log step](./images/flows-1.png)

## Viewing logs

The right sidebar of a flow has a logs section: each run records the input and output data of every step.

> [!NOTE] The send email operation runs all its steps but sends no mail: Backoffice writes the content to the server
> log.

> [!WARNING] A flow triggered by an event runs for every change that matches its conditions, including changes made by
> an import or by another flow.

## Related

- The environment variables a flow can read through `$env`, and the limits of the run script operation:
  [Flows](/docs/configuration/flows-extensions#flows).
- API: [flows](/docs/api/flows#list-flows), [operations](/docs/api/operations#list-operations).
