The **Insights** module builds dashboards from your data: totals, charts over time, lists, labels. Each dashboard is a
grid of panels; each panel reads a collection with the permissions of the person viewing it.

## Opening a dashboard

1. Click the **Insights** tile in the module block.
2. Choose a dashboard in the list or in the sidebar.

![Sales dashboard: two metric panels, Products on Sale and Total Stock, and a list panel, Running Low](./images/insights-1.png)

## Creating a dashboard

1. On the dashboard list page, click the **+** button, set a name and an icon, and save.
2. Open the new dashboard and click the edit button (the pencil icon) to enter edit mode.
3. Click add panel, choose a panel type (for example Metric, Time Series, List) and fill in the options: collection,
   field, aggregate function, filter.
4. Drag a panel to move it, drag its bottom corner to resize it.
5. Click save; all the changes of the editing session are written at once.

## Dashboard variables

A variable panel creates an input (for example a date range picker) that other panels use in their filters with the
syntax `{{ variable_name }}`. Changing the value of that input recalculates every panel that uses the variable.

> [!NOTE] Panels can only be dragged and resized with a mouse.

## Related

- API: [dashboards](/docs/api/dashboards#list-dashboards), [panels](/docs/api/panels#list-panels).
