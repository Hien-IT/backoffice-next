**Activity** records every action on the data: who created, updated, deleted or signed in, when, and in which
collection. **Notifications** are messages sent to you in the app, for example when someone mentions you in a comment or
when a flow sends a notification.

## Viewing notifications

1. Click the bell at the bottom of the sidebar. The number on the bell is the number of unread notifications.
2. The notification panel shows the latest messages. Click the check mark to mark one as read, or **Mark all as read**.
3. Click a message to open the item it refers to.
4. Click **View all** to open the notifications drawer with its inbox and archive.

![Notification panel opened from the bell: a notification that Floral Dress is running low, the Mark all as read and View all buttons](./images/activity-notifications-2.png)

> [!NOTE] Backoffice does not send emails for notifications; they are only shown in the app.

## Viewing activity

1. Open the notifications drawer (the bell, then **View all**) and choose **Activity**.
2. The sidebar filters by action (create, update, delete, login) or shows only your own activity.
3. Click a row to see its details: the data before and after the change.

![Activity list filtered by the Create action: columns for action, collection, timestamp and user](./images/activity-notifications-1.png)

## Retention

The server can delete activity, revisions and flow logs automatically after a while; see
[Data retention](/docs/configuration/data#data-retention).

## Related

- API: [activity](/docs/api/activity#list-activity-actions),
  [notifications](/docs/api/notifications#list-notifications).
